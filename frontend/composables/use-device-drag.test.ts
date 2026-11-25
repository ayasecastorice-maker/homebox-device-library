import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref, shallowRef, watch } from "vue";
import type { SortableEvent, Options } from "sortablejs";
import { useDeviceDrag } from "./use-device-drag";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("sortablejs", () => ({ default: { create } }));
vi.mock("@vueuse/core", async () => {
  const { ref, unref } = await import("vue");
  return {
    unrefElement: unref,
    usePreferredReducedMotion: () => ref("no-preference"),
  };
});

type Node = { id: string; parentNode: object | null };
const scopes: ReturnType<typeof effectScope>[] = [];
beforeEach(() => {
  create.mockReset();
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("watch", watch);
});
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  vi.unstubAllGlobals();
});

async function setup() {
  const classes = new Set<string>();
  const element = {
    children: [] as Node[],
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
    setAttribute: vi.fn(),
    insertBefore(node: Node, next: Node | null) {
      if (next && !this.children.includes(next))
        throw new Error("Detached insertBefore anchor");
      this.children.splice(this.children.indexOf(node), 1);
      this.children.splice(
        next ? this.children.indexOf(next) : this.children.length,
        0,
        node,
      );
    },
  };
  const nodes = ["a", "b", "c"].map(
    (id) => ({ id, parentNode: element }) as Node,
  );
  element.children = [...nodes];
  const container = shallowRef<HTMLElement>();
  const enabled = ref(true),
    move = vi.fn(),
    destroy = vi.fn();
  let options!: Options;
  create.mockImplementation((_element, value) => {
    options = value;
    return { destroy };
  });
  const scope = effectScope();
  scopes.push(scope);
  const state = scope.run(() => useDeviceDrag(container, enabled, move))!;
  container.value = element as unknown as HTMLElement;
  await nextTick();
  function start() {
    options.onChoose?.({} as SortableEvent);
    const preview: Node = { id: "temporary-preview", parentNode: element };
    element.children.push(preview);
    options.onStart?.({} as SortableEvent);
    return preview;
  }
  async function drop(from: number, to: number) {
    const item = element.children[from]!;
    const preview = start();
    element.children.splice(from, 1);
    element.children.splice(to, 0, item);
    // Sortable removes its preview before dispatching onEnd.
    element.children.splice(element.children.indexOf(preview), 1);
    preview.parentNode = null;
    options.onEnd?.({
      item,
      oldDraggableIndex: from,
      newDraggableIndex: to,
    } as unknown as SortableEvent);
    await Promise.resolve();
  }
  return { element, nodes, classes, state, move, drop, enabled, destroy };
}

describe("Device drag DOM restoration", () => {
  it("excludes the removed preview when restoring a last-card drag", async () => {
    const { element, nodes, classes, state, move, drop } = await setup();
    await drop(2, 0);
    expect(element.children).toEqual(nodes);
    expect(move).toHaveBeenCalledExactlyOnceWith(2, 0);
    expect(state.dragging.value).toBe(false);
    expect(classes.has("is-sorting")).toBe(false);
  });
  it("restores a forward drag before the original real sibling", async () => {
    const { element, nodes, move, drop } = await setup();
    await drop(0, 2);
    expect(element.children).toEqual(nodes);
    expect(move).toHaveBeenCalledExactlyOnceWith(0, 2);
  });
  it("clears last-card drag state even when the position did not change", async () => {
    const { state, move, drop } = await setup();
    await drop(2, 2);
    expect(state.dragging.value).toBe(false);
    expect(move).not.toHaveBeenCalled();
  });
  it("can drag again after Vue applies the preceding saved order", async () => {
    const { element, nodes, state, move, drop } = await setup();
    await drop(2, 0);
    element.children = [nodes[2]!, nodes[0]!, nodes[1]!];
    await drop(2, 0);
    expect(element.children).toEqual([nodes[2], nodes[0], nodes[1]]);
    expect(move).toHaveBeenCalledTimes(2);
    expect(state.dragging.value).toBe(false);
  });
});

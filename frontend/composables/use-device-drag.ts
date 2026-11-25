import Sortable from "sortablejs";
import {
  unrefElement,
  usePreferredReducedMotion,
  type MaybeElementRef,
} from "@vueuse/core";
import type { Ref } from "vue";

export function useDeviceDrag(
  container: MaybeElementRef,
  enabled: Ref<boolean>,
  move: (from: number, to: number) => void,
) {
  const reduced = usePreferredReducedMotion();
  const dragging = ref(false);
  watch(
    [() => unrefElement(container), enabled, reduced],
    ([element, active], _, cleanup) => {
      if (!element || !active) return;
      let original: Element[] = [];
      const sortable = Sortable.create(element as HTMLElement, {
        handle: ".device-order-grip",
        draggable: "[data-device-id]",
        animation: reduced.value === "reduce" ? 0 : 180,
        forceFallback: true,
        fallbackTolerance: 5,
        delayOnTouchOnly: true,
        delay: 100,
        touchStartThreshold: 4,
        ghostClass: "device-sort-ghost",
        chosenClass: "device-sort-chosen",
        fallbackClass: "device-sort-fallback",
        onChoose() {
          // Capture real siblings before Sortable appends its temporary drag preview.
          original = [...element.children];
        },
        onStart() {
          element.setAttribute("data-order-used", "");
          dragging.value = true;
          element.classList.add("is-sorting");
        },
        onEnd(event) {
          const from = event.oldDraggableIndex,
            to = event.newDraggableIndex;
          // Let Vue own the final DOM order, rather than retaining Sortable's mutation.
          const index = original.indexOf(event.item);
          const next = original
            .slice(index + 1)
            .find((node) => node.parentNode === element);
          if (index >= 0 && event.item.parentNode === element)
            element.insertBefore(event.item, next || null);
          element.classList.remove("is-sorting");
          dragging.value = false;
          if (from !== undefined && to !== undefined && from !== to)
            queueMicrotask(() => move(from, to));
        },
      });
      cleanup(() => {
        sortable.destroy();
        element.classList.remove("is-sorting");
        dragging.value = false;
      });
    },
    { flush: "post" },
  );
  return { dragging };
}

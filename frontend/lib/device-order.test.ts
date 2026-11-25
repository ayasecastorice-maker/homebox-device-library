import { describe, it, expect } from "vitest";
import {
  manualDeviceOrder,
  sortDevices,
  moveDeviceInSubset,
  deviceSortOptions,
  normalizeDeviceDisplay,
  deviceArrangement,
  updateDeviceArrangement,
  type DeviceDisplay,
} from "./device-order";
import { categories, setTextField } from "./devices";
import type { EntityOut } from "./api/types/data-contracts";
const items = [
  {
    id: "a",
    name: "设备 10",
    createdAt: new Date("2026-09-30"),
    purchaseDate: "2024-01-01",
    purchasePrice: 10,
    quantity: 3,
  },
  {
    id: "b",
    name: "设备 2",
    createdAt: new Date("2026-10-01"),
    purchaseDate: "",
    purchasePrice: 20,
    quantity: 1,
  },
  {
    id: "c",
    name: "设备 1",
    createdAt: new Date("2026-01-01"),
    purchaseDate: "2025-06-01",
    purchasePrice: 5,
    quantity: 1,
  },
] as EntityOut[];
const ids = (list: EntityOut[]) => list.map((i) => i.id);
describe("Device display ordering", () => {
  it("defaults to newest-first and handles parsed Date objects chronologically", () => {
    expect(manualDeviceOrder(items, [])).toEqual(["b", "a", "c"]);
    expect(ids(sortDevices(items, "added-asc", []))).toEqual(["c", "a", "b"]);
  });
  it("keeps saved positions, discards deleted/duplicate IDs and appends new devices", () => {
    expect(manualDeviceOrder(items, ["c", "missing", "c", "a"])).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(ids(sortDevices(items, "manual", ["c", "a"]))).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
  it("keeps undated purchases last in both directions", () => {
    expect(ids(sortDevices(items, "purchase-asc", []))).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(ids(sortDevices(items, "purchase-desc", []))).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
  it("uses recorded total amount, including quantity", () => {
    expect(ids(sortDevices(items, "price-desc", []))).toEqual(["a", "b", "c"]);
    expect(ids(sortDevices(items, "price-asc", []))).toEqual(["c", "b", "a"]);
  });
  it("sorts names naturally and supports reverse order", () => {
    expect(ids(sortDevices(items, "name-asc", []))).toEqual(["c", "b", "a"]);
    expect(ids(sortDevices(items, "name-desc", []))).toEqual(["a", "b", "c"]);
  });
  it("does not mutate item arrays or the saved manual order", () => {
    const source = [...items],
      order = ["c", "a", "b"];
    for (const option of deviceSortOptions)
      sortDevices(source, option.value, order);
    expect(source).toEqual(items);
    expect(order).toEqual(["c", "a", "b"]);
  });
  it("reorders a filtered subset without moving hidden slots", () => {
    expect(
      moveDeviceInSubset(["a", "x", "b", "y", "c"], ["a", "b", "c"], "c", 0),
    ).toEqual(["c", "x", "a", "y", "b"]);
  });
  it("supports positions across pages", () => {
    const all = Array.from({ length: 25 }, (_, n) => String(n));
    const result = moveDeviceInSubset(all, all, "0", 19);
    expect(result[19]).toBe("0");
    expect(new Set(result).size).toBe(25);
    expect(result[20]).toBe("20");
  });
  it("ignores invalid moves and tolerates an empty library", () => {
    for (const target of [-1, 3, NaN, 1.5])
      expect(moveDeviceInSubset(["a", "b"], ["a", "b"], "a", target)).toEqual([
        "a",
        "b",
      ]);
    expect(moveDeviceInSubset(["a"], ["missing"], "missing", 0)).toEqual(["a"]);
    expect(moveDeviceInSubset(["a"], ["a", "a"], "a", 0)).toEqual(["a"]);
    expect(sortDevices([], "manual", ["gone"])).toEqual([]);
  });
});

describe("Independent category arrangements", () => {
  const source = items.map((item, index) => ({
    ...item,
    fields: setTextField([], "设备分类", index ? "外设" : "电脑"),
  }));
  const legacy: DeviceDisplay = {
    sort: "manual",
    order: ["c", "a", "b"],
    revision: 7,
  };
  it("seeds all categories from legacy order without changing the all-devices view", () => {
    const next = normalizeDeviceDisplay(source, legacy);
    expect(next.order).toEqual(legacy.order);
    expect(Object.keys(next.categories!)).toEqual([...categories]);
    expect(next.categories!["外设"]).toEqual({
      sort: "manual",
      order: ["c", "b"],
    });
    expect(next.categories!["电脑"]!.order).toEqual(["a"]);
    expect(next.categories!["手表"]!.order).toEqual([]);
    expect(legacy.categories).toBeUndefined();
    expect(next.revision).toBe(7);
  });
  it("freezes unvisited categories before the first global move", () => {
    const next = updateDeviceArrangement(source, legacy, "全部", "manual", [
      "b",
      "a",
      "c",
    ]);
    expect(next.order).toEqual(["b", "a", "c"]);
    expect(next.categories!["外设"]!.order).toEqual(["c", "b"]);
    expect(normalizeDeviceDisplay(source, next).categories).toEqual(
      next.categories,
    );
  });
  it("category moves do not alter global order or another category", () => {
    const next = updateDeviceArrangement(source, legacy, "外设", "manual", [
      "b",
      "c",
    ]);
    expect(next.order).toEqual(legacy.order);
    expect(deviceArrangement(next, "外设").order).toEqual(["b", "c"]);
    expect(deviceArrangement(next, "电脑").order).toEqual(["a"]);
    expect(deviceArrangement(next, "全部").order).toEqual(legacy.order);
  });
  it("each view remembers its automatic mode and manual arrangement", () => {
    let next = normalizeDeviceDisplay(source, {
      ...legacy,
      sort: "price-desc",
    });
    expect(next.categories!["外设"]!.sort).toBe("price-desc");
    next = updateDeviceArrangement(source, next, "外设", "name-asc", [
      "c",
      "b",
    ]);
    expect(next.sort).toBe("price-desc");
    expect(next.categories!["电脑"]!.sort).toBe("price-desc");
    expect(next.categories!["外设"]!.sort).toBe("name-asc");
    next = updateDeviceArrangement(
      source,
      next,
      "全部",
      "added-asc",
      next.order,
    );
    expect(next.categories!["外设"]!.sort).toBe("name-asc");
    expect(next.categories!["外设"]!.order).toEqual(["c", "b"]);
  });
  it("new devices append within their category without inheriting later global moves", () => {
    const next = updateDeviceArrangement(source, legacy, "全部", "manual", [
      "b",
      "a",
      "c",
    ]);
    const added = { ...source[1]!, id: "d" };
    const normalized = normalizeDeviceDisplay([...source, added], next);
    expect(normalized.order).toEqual(["b", "a", "c", "d"]);
    expect(normalized.categories!["外设"]!.order).toEqual(["c", "b", "d"]);
  });
  it("category changes and deletions preserve remaining relative positions", () => {
    const before = normalizeDeviceDisplay(source, legacy);
    const changed = source
      .filter((item) => item.id !== "a")
      .map((item) =>
        item.id === "c"
          ? { ...item, fields: setTextField([], "设备分类", "手表") }
          : item,
      );
    const after = normalizeDeviceDisplay(changed, before);
    expect(after.order).toEqual(["c", "b"]);
    expect(after.categories!["外设"]!.order).toEqual(["b"]);
    expect(after.categories!["电脑"]!.order).toEqual([]);
    expect(after.categories!["手表"]!.order).toEqual(["c"]);
    expect(before.categories!["外设"]!.order).toEqual(["c", "b"]);
  });
  it("filtered moves replace only visible slots within the active category", () => {
    const next = normalizeDeviceDisplay(source, legacy);
    const order = moveDeviceInSubset(
      next.categories!["外设"]!.order,
      ["c", "b"],
      "b",
      0,
    );
    const saved = updateDeviceArrangement(
      source,
      next,
      "外设",
      "manual",
      order,
    );
    expect(saved.order).toEqual(legacy.order);
    expect(saved.categories!["外设"]!.order).toEqual(["b", "c"]);
    expect(saved.categories!["电脑"]).toEqual(next.categories!["电脑"]);
  });
});

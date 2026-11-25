import { describe, it, expect } from "vitest";
import {
  summarize,
  csvCell,
  costCents,
  dateOnly,
  groupMeta,
  setTextField,
  updatePayload,
  status,
  categories,
  categoryColors,
  category,
  inventoryCSV,
} from "./devices";
import type { EntityOut, TagOut } from "./api/types/data-contracts";
const item = (overrides: Partial<EntityOut> = {}) =>
  ({
    id: "1",
    name: "Laptop",
    quantity: 1,
    purchasePrice: 0,
    purchaseDate: "",
    soldDate: "",
    fields: [],
    tags: [],
    ...overrides,
  }) as EntityOut;
describe("Personal device accounting", () => {
  it("places watches directly after phones and preserves existing category colors", () => {
    expect(categories).toEqual([
      "电脑",
      "外设",
      "音频",
      "手机",
      "手表",
      "其他",
    ]);
    expect(categoryColors).toHaveLength(categories.length);
    expect(categoryColors[categories.indexOf("手机")]).toBe("#91A9B5");
    expect(categoryColors[categories.indexOf("其他")]).toBe("#BBB5AC");
  });
  it("recognizes stored watch classifications and keeps unknown categories as other", () => {
    expect(
      category(item({ fields: setTextField([], "设备分类", "手表") })),
    ).toBe("手表");
    expect(
      category(item({ fields: setTextField([], "设备分类", "未定义分类") })),
    ).toBe("其他");
  });
  it("summarizes and exports watches separately from phones and other devices", () => {
    const watch = item({
      name: "QA Watch",
      quantity: 2,
      purchasePrice: 1999,
      purchaseDate: "2026-10-01",
      fields: setTextField([], "设备分类", "手表"),
    });
    const phone = item({
      purchasePrice: 500,
      fields: setTextField([], "设备分类", "手机"),
    });
    const s = summarize([watch, phone], 2026);
    expect(s.byCategory.find((c) => c.name === "手表")).toEqual({
      name: "手表",
      cents: 399800,
      count: 2,
    });
    expect(s.byCategory.find((c) => c.name === "手机")?.cents).toBe(50000);
    expect(s.byCategory.find((c) => c.name === "其他")?.cents).toBe(0);
    expect(s.total).toBe(449800);
    expect(inventoryCSV([watch])).toContain('"QA Watch","手表",');
  });
  it("has a genuinely empty initial state", () => {
    const s = summarize([], 2026);
    expect(s.total).toBe(0);
    expect(s.months).toEqual(Array(12).fill(0));
    expect(s.byCategory.every((c) => c.cents === 0)).toBe(true);
  });
  it("multiplies unit price and quantity without floating point accumulation", () => {
    expect(costCents(item({ purchasePrice: 0.1, quantity: 3 }))).toBe(30);
  });
  it("separates year spend from lifetime spend and ignores undated purchases", () => {
    const s = summarize(
      [
        item({ purchasePrice: 100, quantity: 2, purchaseDate: "2026-03-03" }),
        item({ purchasePrice: 50, purchaseDate: "2025-03-03" }),
        item({ purchasePrice: 10, purchaseDate: "0001-01-01" }),
      ],
      2026,
    );
    expect(s.total).toBe(26000);
    expect(s.yearTotal).toBe(20000);
    expect(s.months[2]).toBe(20000);
    expect(s.undated).toBe(1);
    expect(s.byCategory.reduce((n, c) => n + c.cents, 0)).toBe(s.total);
  });
  it("treats sold and archived as distinct from in-use", () => {
    expect(status(item({ soldDate: "2026-01-01" }))).toBe("已售出");
    expect(status(item({ archived: true }))).toBe("已归档");
  });
  it("preserves unrelated custom fields and field identifiers", () => {
    const fields = setTextField(
      [
        {
          id: "a",
          name: "RAM",
          type: "text",
          textValue: "32 GB",
          numberValue: 0,
          booleanValue: false,
        },
      ],
      "设备分类",
      "电脑",
    );
    expect(fields[0]?.textValue).toBe("32 GB");
    expect(setTextField(fields, "设备分类", "手机")).toHaveLength(2);
  });
  it("preserves explicit and inherited location boundaries", () => {
    const p = updatePayload(
      item({ locationId: null, parent: { id: "parent" } as EntityOut }),
    );
    expect(p.locationId).toBeNull();
    expect(p.parentId).toBe("parent");
  });
  it("rejects empty and sentinel dates", () => {
    expect(dateOnly("0001-01-01")).toBe("");
    expect(dateOnly("invalid")).toBe("");
    expect(dateOnly("2026-10-25")).toBe("2026-10-25");
  });
  it("protects CSV formula cells and quotes", () => {
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(" @cmd")).toBe('"\' @cmd"');
  });
  it("parses equipment metadata and tolerates ordinary descriptions", () => {
    expect(
      groupMeta({
        description: '{"version":1,"description":"Desk","coverId":"abc"}',
      } as TagOut).coverId,
    ).toBe("abc");
    expect(groupMeta({ description: "Notes" } as TagOut).description).toBe(
      "Notes",
    );
  });
});

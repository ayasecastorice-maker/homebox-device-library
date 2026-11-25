import { describe, expect, it } from "vitest";
import type { EntityOut } from "./api/types/data-contracts";
import { queryPurchases, purchasesCSV } from "./device-purchases";
import { setTextField, summarize } from "./devices";

const item = (id: string, overrides: Partial<EntityOut> = {}) =>
  ({
    id,
    name: id,
    modelNumber: "",
    manufacturer: "",
    purchaseFrom: "",
    purchaseDate: "2026-03-01",
    purchasePrice: 0,
    quantity: 1,
    fields: [],
    tags: [],
    ...overrides,
  }) as EntityOut;
const fixtures = [
  item("a", {
    name: "Laptop",
    modelNumber: "AIR 14",
    quantity: 3,
    purchasePrice: 0.1,
    purchaseDate: "2026-03-31",
    fields: setTextField([], "设备分类", "电脑"),
  }),
  item("b", {
    name: "Headphones",
    purchasePrice: 15.99,
    purchaseDate: new Date("2026-03-01T00:00:00Z"),
    fields: setTextField([], "设备分类", "音频"),
  }),
  item("c", { purchaseDate: "2025-03-20", purchasePrice: 20 }),
  item("d", { purchaseDate: "2026-04-01", purchasePrice: 25 }),
  item("e", { purchaseDate: "0001-01-01", purchasePrice: 30 }),
  item("f", { purchaseDate: "", purchasePrice: 40 }),
];
describe("Monthly purchase details", () => {
  it("matches the existing chart totals for each month and the full year", () => {
    const stats = summarize(fixtures, 2026);
    for (let month = 1; month <= 12; month++) {
      expect(
        queryPurchases(fixtures, { year: 2026, period: month }).cents,
      ).toBe(stats.months[month - 1]);
    }
    expect(queryPurchases(fixtures, { year: 2026, period: "all" }).cents).toBe(
      stats.yearTotal,
    );
  });
  it("keeps records and quantities distinct and sums in integer cents", () => {
    const result = queryPurchases(fixtures, { year: 2026, period: 3 });
    expect(result.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.quantity).toBe(4);
    expect(result.cents).toBe(1629);
  });
  it("separates years and never uses creation date as purchase date", () => {
    expect(
      queryPurchases(fixtures, { year: 2025, period: 3 }).items.map(
        (i) => i.id,
      ),
    ).toEqual(["c"]);
    expect(
      queryPurchases(
        [
          item("created", {
            purchaseDate: "",
            createdAt: new Date("2026-03-01"),
          }),
        ],
        { year: 2026, period: 3 },
      ).items,
    ).toEqual([]);
  });
  it("provides an undated view independent of the selected year", () => {
    for (const year of [2025, 2026])
      expect(
        queryPurchases(fixtures, { year, period: "undated" }).items.map(
          (i) => i.id,
        ),
      ).toEqual(["e", "f"]);
  });
  it("combines category and case-insensitive name/model searches", () => {
    const filters = {
      year: 2026,
      period: 3,
      query: "  air  ",
      category: "电脑",
    };
    expect(queryPurchases(fixtures, filters).items.map((i) => i.id)).toEqual([
      "a",
    ]);
    expect(
      queryPurchases(fixtures, { ...filters, category: "音频" }).items,
    ).toEqual([]);
  });
  it("retains zero-cost purchases and follows the caller's archived scope", () => {
    const rows = [
      item("free"),
      item("archived", { archived: true, purchasePrice: 10 }),
    ];
    expect(queryPurchases(rows, { year: 2026, period: 3 }).items).toHaveLength(
      2,
    );
    expect(
      queryPurchases(
        rows.filter((i) => !i.archived),
        { year: 2026, period: 3 },
      ).cents,
    ).toBe(0);
  });
  it("returns an empty result for an empty month or invalid month", () => {
    for (const period of [2, 0, 13, NaN])
      expect(queryPurchases(fixtures, { year: 2026, period })).toEqual({
        items: [],
        quantity: 0,
        cents: 0,
      });
  });
  it("sorts equal dates deterministically without mutating inventory or manual order", () => {
    const source = Object.freeze([item("z"), item("a")]);
    const before = JSON.stringify(source);
    expect(
      queryPurchases(source, { year: 2026, period: 3 }).items.map((i) => i.id),
    ).toEqual(["a", "z"]);
    expect(JSON.stringify(source)).toBe(before);
  });
  it("exports matched rows, unit price, quantity, subtotal, channel and currency", () => {
    const csv = purchasesCSV(
      [
        item("export", {
          quantity: 3,
          purchasePrice: 0.1,
          purchaseFrom: "Official store",
        }),
      ],
      "CNY",
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"数量","购入单价","购入小计","购入渠道","币种"');
    expect(csv).toContain('"3","0.1","0.3","Official store","CNY"');
  });
  it("keeps CSV escaping and formula-injection protection for user text", () => {
    const csv = purchasesCSV(
      [
        item("csv", {
          name: '=HYPERLINK("test")',
          purchaseFrom: "Shop, with\nnew line",
        }),
      ],
      "CNY",
    );
    expect(csv).toContain(`"'=HYPERLINK(""test"")"`);
    expect(csv).toContain('"Shop, with\nnew line"');
  });
});

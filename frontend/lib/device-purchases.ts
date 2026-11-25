import type { EntityOut } from "./api/types/data-contracts";
import { category, costCents, csvCell, dateOnly } from "./devices";

export type PurchasePeriod = number | "all" | "undated";
export type PurchaseQuery = {
  year: number;
  period: PurchasePeriod;
  query?: string;
  category?: string;
};

export function queryPurchases(
  source: readonly EntityOut[],
  filters: PurchaseQuery,
) {
  const query = (filters.query || "").trim().toLowerCase();
  const items = source
    .filter((item) => {
      const date = dateOnly(item.purchaseDate);
      const inPeriod =
        filters.period === "undated"
          ? !date
          : !!date &&
            Number(date.slice(0, 4)) === filters.year &&
            (filters.period === "all" ||
              Number(date.slice(5, 7)) === filters.period);
      return (
        inPeriod &&
        (!filters.category ||
          filters.category === "all" ||
          category(item) === filters.category) &&
        [item.name, item.modelNumber, item.manufacturer]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    })
    .sort(
      (a, b) =>
        dateOnly(b.purchaseDate).localeCompare(dateOnly(a.purchaseDate)) ||
        a.id.localeCompare(b.id),
    );
  return {
    items,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    cents: items.reduce((sum, item) => sum + costCents(item), 0),
  };
}

export function purchasesCSV(items: readonly EntityOut[], currency: string) {
  const rows: unknown[][] = [
    [
      "设备名称",
      "型号",
      "购入日期",
      "分类",
      "数量",
      "购入单价",
      "购入小计",
      "购入渠道",
      "币种",
    ],
  ];
  for (const item of items) {
    rows.push([
      item.name,
      item.modelNumber,
      dateOnly(item.purchaseDate),
      category(item),
      item.quantity,
      Math.round(Number(item.purchasePrice || 0) * 100) / 100,
      costCents(item) / 100,
      item.purchaseFrom,
      currency,
    ]);
  }
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

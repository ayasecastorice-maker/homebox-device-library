import type {
  EntityOut,
  EntityFieldData,
  EntityUpdate,
  TagOut,
} from "./api/types/data-contracts";

export const categories = [
  "电脑",
  "外设",
  "音频",
  "手机",
  "手表",
  "其他",
] as const;
export const statuses = ["在用", "闲置", "维修中", "已售出", "已归档"] as const;
export const categoryColors = [
  "#D97757",
  "#65889B",
  "#A79A83",
  "#91A9B5",
  "#7F9A88",
  "#BBB5AC",
];
export const CATEGORY_FIELD = "设备分类";
export const STATUS_FIELD = "使用状态";
export const GROUP_ICON = "device-equipment-group";

export function field(item: EntityOut, name: string) {
  return item.fields?.find((f) => f.name === name)?.textValue ?? "";
}
export function category(item: EntityOut) {
  const value = field(item, CATEGORY_FIELD);
  return categories.includes(value as (typeof categories)[number])
    ? value
    : "其他";
}
export function dateOnly(value: string | Date | undefined) {
  if (!value) return "";
  const s =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value.slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    s <= "0001-01-01" ||
    Number.isNaN(Date.parse(s))
  )
    return "";
  return s;
}
export function status(item: EntityOut) {
  if (item.archived) return "已归档";
  if (dateOnly(item.soldDate)) return "已售出";
  return field(item, STATUS_FIELD) || "在用";
}
export function costCents(item: Pick<EntityOut, "purchasePrice" | "quantity">) {
  return (
    Math.round(Number(item.purchasePrice || 0) * 100) *
    Number(item.quantity || 0)
  );
}
export function money(value: number, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
export function setTextField(
  fields: EntityFieldData[],
  name: string,
  value: string,
) {
  const old = fields.find((f) => f.name === name);
  return [
    ...fields.filter((f) => f.name !== name),
    {
      id: old?.id || null,
      name,
      type: "text",
      textValue: value,
      numberValue: 0,
      booleanValue: false,
    } as unknown as EntityFieldData,
  ];
}
export function updatePayload(item: EntityOut): EntityUpdate {
  return {
    ...item,
    entityTypeId: item.entityType?.id || "",
    parentId: item.parent?.id || null,
    locationId: item.locationId || null,
    tagIds: (item.tags || []).map((t) => t.id),
    fields: item.fields || [],
  };
}
export function groupMeta(tag: TagOut): {
  description: string;
  coverId: string;
} {
  try {
    const v = JSON.parse(tag.description);
    if (v.version === 1 && typeof v.description === "string")
      return {
        description: v.description,
        coverId: typeof v.coverId === "string" ? v.coverId : "",
      };
  } catch {
    /* Ordinary Homebox tags retain their description. */
  }
  return { description: tag.description || "", coverId: "" };
}
export function summarize(items: EntityOut[], year: number) {
  const months = Array<number>(12).fill(0);
  const byCategory = categories.map((name) => ({ name, cents: 0, count: 0 }));
  let total = 0,
    inUse = 0,
    idle = 0,
    undated = 0;
  for (const item of items) {
    const cents = costCents(item);
    total += cents;
    const c = byCategory.find((c) => c.name === category(item))!;
    c.cents += cents;
    c.count += item.quantity;
    if (status(item) === "在用") inUse += item.quantity;
    if (status(item) === "闲置") idle += item.quantity;
    const d = dateOnly(item.purchaseDate);
    if (!d) undated += item.quantity;
    else if (Number(d.slice(0, 4)) === year)
      months[Number(d.slice(5, 7)) - 1]! += cents;
  }
  return {
    total,
    months,
    byCategory,
    inUse,
    idle,
    undated,
    yearTotal: months.reduce((a, b) => a + b, 0),
  };
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function inventoryCSV(items: EntityOut[]) {
  const rows: unknown[][] = [
    [
      "设备名称",
      "分类",
      "状态",
      "品牌",
      "型号",
      "序列号",
      "数量",
      "购入单价",
      "购入总额",
      "购入日期",
      "分组",
    ],
  ];
  for (const i of items)
    rows.push([
      i.name,
      category(i),
      status(i),
      i.manufacturer,
      i.modelNumber,
      i.serialNumber,
      i.quantity,
      i.purchasePrice,
      costCents(i) / 100,
      dateOnly(i.purchaseDate),
      i.tags.map((t) => t.name).join(" / "),
    ]);
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function downloadCSV(items: EntityOut[], filename: string) {
  const url = URL.createObjectURL(
    new Blob([inventoryCSV(items)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import type { EntityOut } from "./api/types/data-contracts";
import { categories, category, costCents, dateOnly } from "./devices";

export const deviceSortOptions = [
  { value: "manual", label: "自定义" },
  { value: "added-desc", label: "添加倒序" },
  { value: "added-asc", label: "添加正序" },
  { value: "purchase-desc", label: "购入倒序" },
  { value: "purchase-asc", label: "购入正序" },
  { value: "price-desc", label: "金额降序" },
  { value: "price-asc", label: "金额升序" },
  { value: "name-asc", label: "名称升序" },
  { value: "name-desc", label: "名称降序" },
] as const;
export type DeviceSort = (typeof deviceSortOptions)[number]["value"];
export type DeviceArrangement = {
  sort: DeviceSort;
  order: string[];
};
export type DeviceDisplay = DeviceArrangement & {
  revision: number;
  categories?: Record<string, DeviceArrangement>;
};
const names = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});
function timestamp(value: string | Date) {
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
}
function newest(a: EntityOut, b: EntityOut) {
  return (
    timestamp(b.createdAt) - timestamp(a.createdAt) || a.id.localeCompare(b.id)
  );
}

export function normalizeDeviceDisplay(
  items: EntityOut[],
  state: DeviceDisplay,
): DeviceDisplay {
  // Freeze every category from the legacy order before any one view changes.
  return {
    ...state,
    order: manualDeviceOrder(items, state.order),
    categories: Object.fromEntries(
      categories.map((name) => {
        const saved = state.categories?.[name];
        return [
          name,
          {
            sort: saved?.sort ?? state.sort,
            order: manualDeviceOrder(
              items.filter((item) => category(item) === name),
              saved?.order ?? state.order,
            ),
          },
        ];
      }),
    ),
  };
}

export function deviceArrangement(
  state: DeviceDisplay,
  scope: string,
): DeviceArrangement {
  return state.categories?.[scope] ?? state;
}

export function updateDeviceArrangement(
  items: EntityOut[],
  state: DeviceDisplay,
  scope: string,
  sort: DeviceSort,
  order: string[],
): DeviceDisplay {
  const next = normalizeDeviceDisplay(items, state);
  if (categories.some((name) => name === scope)) {
    return {
      ...next,
      categories: { ...next.categories, [scope]: { sort, order: [...order] } },
    };
  }
  return { ...next, sort, order: [...order] };
}

export function manualDeviceOrder(
  items: EntityOut[],
  stored: string[],
): string[] {
  const known = new Set(items.map((i) => i.id));
  const saved = [...new Set(stored)].filter((id) => known.has(id));
  const placed = new Set(saved);
  return [
    ...saved,
    ...items
      .filter((i) => !placed.has(i.id))
      .sort(newest)
      .map((i) => i.id),
  ];
}

export function sortDevices(
  items: EntityOut[],
  mode: DeviceSort,
  stored: string[],
): EntityOut[] {
  const ranks = new Map(
    manualDeviceOrder(items, stored).map((id, index) => [id, index]),
  );
  return [...items].sort((a, b) => {
    let difference = 0;
    const direction = mode.endsWith("desc") ? -1 : 1;
    if (mode === "manual") return ranks.get(a.id)! - ranks.get(b.id)!;
    if (mode.startsWith("added"))
      difference = timestamp(a.createdAt) - timestamp(b.createdAt);
    if (mode.startsWith("purchase")) {
      const da = dateOnly(a.purchaseDate),
        db = dateOnly(b.purchaseDate);
      if (!da || !db) return da ? -1 : db ? 1 : newest(a, b);
      difference = da.localeCompare(db);
    }
    if (mode.startsWith("price")) difference = costCents(a) - costCents(b);
    if (mode.startsWith("name")) difference = names.compare(a.name, b.name);
    return difference * direction || newest(a, b);
  });
}

// Only replace visible slots: filtering must not shuffle unrelated devices.
export function moveDeviceInSubset(
  all: string[],
  subset: string[],
  id: string,
  target: number,
): string[] {
  const from = subset.indexOf(id);
  if (
    from < 0 ||
    !Number.isInteger(target) ||
    target < 0 ||
    target >= subset.length
  )
    return [...all];
  if (
    new Set(subset).size !== subset.length ||
    subset.some((key) => !all.includes(key))
  )
    return [...all];
  const moved = [...subset];
  moved.splice(from, 1);
  moved.splice(target, 0, id);
  const visible = new Set(subset);
  let index = 0;
  return all.map((key) => (visible.has(key) ? moved[index++]! : key));
}

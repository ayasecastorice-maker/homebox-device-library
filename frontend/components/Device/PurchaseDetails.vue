<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImageIcon,
  Search,
  X,
  RotateCcw,
} from "lucide-vue-next";
import type { EntityOut } from "~/lib/api/types/data-contracts";
import { categories, category, costCents, dateOnly } from "~/lib/devices";
import {
  queryPurchases,
  purchasesCSV,
  type PurchasePeriod,
} from "~/lib/device-purchases";
import GlassSurface from "./GlassSurface.vue";

const props = defineProps<{
  items: EntityOut[];
  year: number;
  loading: boolean;
}>();
const period = defineModel<PurchasePeriod>("period", { required: true });
const emit = defineEmits<{ open: [item: EntityOut] }>();
const { photo, formatMoney, currency } = useDeviceLibrary();
const query = ref(""),
  selectedCategory = ref("all"),
  page = ref(1);
const pageSize = 10;
const filtered = computed(() =>
  queryPurchases(props.items, {
    year: props.year,
    period: period.value,
    query: query.value,
    category: selectedCategory.value,
  }),
);
const pages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.items.length / pageSize)),
);
const visible = computed(() =>
  filtered.value.items.slice(
    (page.value - 1) * pageSize,
    page.value * pageSize,
  ),
);
const narrowed = computed(
  () => !!query.value.trim() || selectedCategory.value !== "all",
);
const periodLabel = computed(() =>
  period.value === "undated"
    ? "未填日期 · 所有年份"
    : period.value === "all"
      ? `${props.year} 年全年`
      : `${props.year} 年 ${period.value} 月`,
);
const emptyLabel = computed(() =>
  narrowed.value
    ? "没有符合条件的购入记录"
    : period.value === "undated"
      ? "没有未填写购入日期的设备"
      : period.value === "all"
        ? "本年度暂无购入记录"
        : "本月暂无购入记录",
);
const transitionKey = computed(
  () =>
    `${props.year}:${period.value}:${query.value}:${selectedCategory.value}:${page.value}`,
);
watch([() => props.year, period, query, selectedCategory], () => {
  page.value = 1;
});
watch(pages, (value) => {
  page.value = Math.min(page.value, value);
});
function clearFilters() {
  query.value = "";
  selectedCategory.value = "all";
}
function exportDetails() {
  const suffix =
    period.value === "undated"
      ? "undated"
      : `${props.year}-${period.value === "all" ? "all" : String(period.value).padStart(2, "0")}`;
  const url = URL.createObjectURL(
    new Blob([purchasesCSV(filtered.value.items, currency.value)], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `homebox-purchases-${suffix}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>

<template>
  <section
    id="purchase-details"
    class="purchase-details"
    aria-labelledby="purchase-details-title"
    :aria-busy="loading"
  >
    <div class="section-heading purchase-heading">
      <div>
        <h2 id="purchase-details-title">购入明细</h2>
        <p class="purchase-period-label">{{ periodLabel }}</p>
      </div>
      <div class="purchase-summary" aria-live="polite" aria-atomic="true">
        <span class="purchase-count"
          >{{ filtered.items.length }} 条记录 ·
          {{ filtered.quantity }} 件设备</span
        >
        <span
          >{{ narrowed ? "筛选结果合计" : "合计" }}
          <strong class="data-text purchase-total">{{
            formatMoney(filtered.cents / 100)
          }}</strong></span
        >
      </div>
    </div>
    <div class="purchase-toolbar">
      <GlassSurface />
      <select v-model="period" aria-label="购入明细月份">
        <option value="all">全年</option>
        <option v-for="month in 12" :key="month" :value="month">
          {{ month }} 月
        </option>
        <option value="undated">未填日期</option>
      </select>
      <label class="search-input purchase-search">
        <Search :size="18" />
        <input
          v-model="query"
          aria-label="搜索购入设备"
          placeholder="设备名称或型号"
        />
        <button
          v-if="query"
          class="purchase-clear"
          type="button"
          aria-label="清空购入搜索"
          title="清空搜索"
          @click="query = ''"
        >
          <X :size="15" />
        </button>
      </label>
      <select v-model="selectedCategory" aria-label="购入明细分类">
        <option value="all">全部分类</option>
        <option v-for="name in categories" :key="name">{{ name }}</option>
      </select>
      <button
        class="btn purchase-export"
        type="button"
        :disabled="loading || !filtered.items.length"
        @click="exportDetails"
      >
        <Download :size="16" />导出明细
      </button>
    </div>
    <Transition name="purchase-fade" mode="out-in">
      <div :key="transitionKey" class="purchase-results">
        <table
          v-if="visible.length"
          class="purchase-table"
          aria-label="购入明细列表"
        >
          <colgroup>
            <col class="purchase-device-col" />
            <col class="purchase-date-col" />
            <col class="purchase-category-col" />
            <col class="purchase-quantity-col" />
            <col class="purchase-unit-col" />
            <col class="purchase-amount-col" />
            <col class="purchase-channel-col" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">设备</th>
              <th scope="col">购入日期</th>
              <th scope="col" class="purchase-category-col">分类</th>
              <th scope="col" class="purchase-quantity-col number">数量</th>
              <th scope="col" class="purchase-unit-col number">单价</th>
              <th scope="col" class="number">小计</th>
              <th scope="col" class="purchase-channel-col">购入渠道</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in visible"
              :key="item.id"
              class="purchase-row"
              :data-purchase-id="item.id"
            >
              <td>
                <button
                  type="button"
                  class="purchase-device"
                  :aria-label="`查看 ${item.name} 的购入详情`"
                  @click="emit('open', item)"
                >
                  <img
                    v-if="photo(item)"
                    :src="photo(item)"
                    :alt="item.name"
                    loading="lazy"
                  /><span v-else class="purchase-thumb"
                    ><ImageIcon :size="21" :stroke-width="1.4"
                  /></span>
                  <span class="purchase-device-copy"
                    ><strong :title="item.name">{{ item.name }}</strong
                    ><small :title="item.modelNumber || item.description"
                      >{{ item.modelNumber || item.description || "未填写型号"
                      }}<template v-if="item.quantity > 1">
                        · {{ item.quantity }} 件</template
                      ></small
                    ></span
                  >
                </button>
              </td>
              <td class="data-text purchase-date">
                {{ dateOnly(item.purchaseDate) || "未填写" }}
              </td>
              <td class="purchase-category-col">{{ category(item) }}</td>
              <td class="purchase-quantity-col number data-text">
                {{ item.quantity }}
              </td>
              <td class="purchase-unit-col number data-text">
                {{
                  formatMoney(
                    Math.round(Number(item.purchasePrice || 0) * 100) / 100,
                  )
                }}
              </td>
              <td class="number data-text purchase-subtotal">
                {{ formatMoney(costCents(item) / 100) }}
              </td>
              <td
                class="purchase-channel-col purchase-channel"
                :title="item.purchaseFrom"
              >
                {{ item.purchaseFrom || "未填写" }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="purchase-empty" role="status">
          <p>{{ emptyLabel }}</p>
          <button
            v-if="narrowed"
            type="button"
            class="btn"
            @click="clearFilters"
          >
            <RotateCcw :size="16" />清除筛选
          </button>
        </div>
      </div>
    </Transition>
    <nav
      v-if="filtered.items.length"
      class="pagination purchase-pagination"
      aria-label="购入明细分页"
    >
      <span
        >显示 {{ (page - 1) * pageSize + 1 }}–{{
          Math.min(page * pageSize, filtered.items.length)
        }}，共 {{ filtered.items.length }} 条记录</span
      >
      <div>
        <button
          type="button"
          class="icon-button"
          :disabled="page === 1"
          aria-label="购入明细上一页"
          title="上一页"
          @click="page--"
        >
          <ChevronLeft :size="16" /></button
        ><span>{{ page }} / {{ pages }}</span
        ><button
          type="button"
          class="icon-button"
          :disabled="page === pages"
          aria-label="购入明细下一页"
          title="下一页"
          @click="page++"
        >
          <ChevronRight :size="16" />
        </button>
      </div>
    </nav>
  </section>
</template>

<style scoped>
.purchase-details {
  min-width: 0;
  margin: 34px 0 42px;
}
.purchase-heading {
  margin: 0 0 18px;
}
.purchase-summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px 20px;
  font-size: 13px;
  color: var(--muted);
}
.purchase-total {
  margin-left: 8px;
  color: var(--ink);
  font-size: 21px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.purchase-toolbar {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: 136px minmax(120px, 1fr) 132px auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: var(--radius-panel);
  margin-bottom: 20px;
  box-shadow: 0 6px 16px -12px #34506455;
}
.purchase-toolbar > :not(.glass-surface) {
  position: relative;
  z-index: 1;
}
.purchase-toolbar select {
  min-width: 0;
  width: 100%;
  padding-right: 12px;
}
.purchase-search {
  min-width: 0;
  width: 100%;
}
.purchase-search > svg {
  flex-shrink: 0;
}
.purchase-clear {
  display: grid;
  place-items: center;
  width: 24px;
  height: 28px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
}
.purchase-table {
  width: 100%;
  table-layout: fixed;
  text-align: left;
  border-collapse: collapse;
}
.purchase-device-col {
  width: 28%;
}
.purchase-date-col {
  width: 14%;
}
.purchase-category-col {
  width: 8%;
}
.purchase-quantity-col {
  width: 6%;
}
.purchase-unit-col {
  width: 13%;
}
.purchase-amount-col {
  width: 14%;
}
.purchase-channel-col {
  width: 17%;
}
.purchase-table th,
.purchase-table td {
  padding: 15px 10px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.purchase-table th {
  padding-top: 11px;
  padding-bottom: 11px;
  font-weight: 500;
  color: var(--muted);
  background: #65889b08;
}
.purchase-table th:first-child,
.purchase-table td:first-child {
  padding-left: 0;
}
.purchase-table th:last-child,
.purchase-table td:last-child {
  padding-right: 0;
}
.purchase-table tbody tr:hover {
  background: #65889b0b;
}
.purchase-table .number {
  text-align: right;
  overflow-wrap: anywhere;
}
.purchase-device {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  color: inherit;
}
.purchase-device img,
.purchase-thumb {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-compact);
  object-fit: contain;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #65889b1a;
}
.purchase-thumb {
  display: grid;
  place-items: center;
  color: #65889b;
}
.purchase-device-copy {
  min-width: 0;
}
.purchase-device strong,
.purchase-device small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.purchase-device strong {
  font-weight: 500;
}
.purchase-device small {
  color: var(--muted);
  font-size: 12px;
  margin-top: 3px;
}
.purchase-date {
  white-space: nowrap;
}
.purchase-channel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.purchase-empty {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14px;
  color: var(--muted);
  font-size: 14px;
  border-bottom: 1px solid var(--line);
}
.purchase-pagination {
  margin-top: 18px;
}
.purchase-fade-enter-active {
  transition: opacity 160ms ease;
}
.purchase-fade-leave-active {
  transition: opacity 80ms ease;
}
.purchase-fade-enter-from,
.purchase-fade-leave-to {
  opacity: 0;
}
@media (max-width: 1200px) {
  .purchase-channel-col {
    display: none;
  }
  .purchase-device-col {
    width: 31%;
  }
  .purchase-date-col {
    width: 18%;
  }
  .purchase-category-col {
    width: 10%;
  }
  .purchase-quantity-col {
    width: 7%;
  }
  .purchase-unit-col {
    width: 17%;
  }
  .purchase-amount-col {
    width: 17%;
  }
}
@media (max-width: 700px) {
  .purchase-heading {
    gap: 10px;
  }
  .purchase-summary {
    width: 100%;
    justify-content: space-between;
    gap: 6px 12px;
  }
  .purchase-total {
    font-size: 18px;
  }
  .purchase-toolbar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
    padding: 8px;
  }
  .purchase-search {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .purchase-export {
    grid-column: 1 / -1;
  }
  .purchase-category-col,
  .purchase-quantity-col,
  .purchase-unit-col {
    display: none;
  }
  .purchase-device-col {
    width: 47%;
  }
  .purchase-date-col {
    width: 25%;
  }
  .purchase-amount-col {
    width: 28%;
  }
  .purchase-table th,
  .purchase-table td {
    padding: 13px 5px;
    font-size: 12px;
  }
  .purchase-device {
    gap: 7px;
  }
  .purchase-device img,
  .purchase-thumb {
    width: 32px;
    height: 32px;
  }
  .purchase-device small {
    font-size: 11px;
  }
  .purchase-date {
    font-size: 11px !important;
  }
}
@media (prefers-reduced-motion: reduce) {
  .purchase-fade-enter-active,
  .purchase-fade-leave-active {
    transition: none;
  }
}
@media (prefers-reduced-transparency: reduce), (forced-colors: active) {
  .purchase-toolbar {
    background: var(--paper);
    border: 1px solid var(--line);
    box-shadow: none;
  }
}
</style>

<script setup lang="ts">
import { Download, Info } from "lucide-vue-next";
import DeviceTable from "~/components/Device/Table.vue";
import Editor from "~/components/Device/Editor.vue";
import PurchaseDetails from "~/components/Device/PurchaseDetails.vue";
import type { PurchasePeriod } from "~/lib/device-purchases";
import {
  summarize,
  categoryColors,
  dateOnly,
  downloadCSV,
} from "~/lib/devices";
import type { EntityOut } from "~/lib/api/types/data-contracts";
definePageMeta({
  layout: "device",
  middleware: ["auth"],
  pageTransition: { name: "device-page", mode: "out-in" },
});
useHead({ title: "资产统计 · Homebox" });
const { items, loading, ready, error, refresh, formatMoney } =
  useDeviceLibrary();
const year = ref(new Date().getFullYear()),
  scope = ref("全部设备");
const purchasePeriod = ref<PurchasePeriod>(new Date().getMonth() + 1);
const canvas = ref<HTMLCanvasElement>();
const selected = ref<EntityOut | null>(null),
  editing = ref(false);
const scoped = computed(() =>
  items.value.filter((i) => scope.value === "全部设备" || !i.archived),
);
const stats = computed(() => summarize(scoped.value, Number(year.value)));
const years = computed(() =>
  Array.from(
    new Set([
      new Date().getFullYear(),
      ...items.value
        .map((i) => Number(dateOnly(i.purchaseDate).slice(0, 4)))
        .filter(Boolean),
    ]),
  ).sort((a, b) => b - a),
);
const max = computed(() => {
  const top = Math.max(...stats.value.months, 10000);
  const unit = 10 ** Math.floor(Math.log10(top));
  return Math.ceil(top / unit) * unit;
});
const recent = computed(() =>
  scoped.value
    .filter((i) => dateOnly(i.purchaseDate))
    .sort((a, b) =>
      dateOnly(b.purchaseDate).localeCompare(dateOnly(a.purchaseDate)),
    )
    .slice(0, 5),
);
function draw() {
  const ctx = canvas.value?.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, 360, 360);
  ctx.lineWidth = 35;
  ctx.strokeStyle = "#e8e6dc";
  ctx.beginPath();
  ctx.arc(180, 180, 132, 0, Math.PI * 2);
  ctx.stroke();
  let start = -Math.PI / 2;
  stats.value.byCategory.forEach((c, index) => {
    if (!c.cents || !stats.value.total) return;
    const end = start + (c.cents / stats.value.total) * Math.PI * 2;
    ctx.strokeStyle = categoryColors[index]!;
    ctx.beginPath();
    ctx.arc(180, 180, 132, start, end);
    ctx.stroke();
    start = end;
  });
  ctx.fillStyle = "#77736b";
  ctx.font = '22px "Homebox WenKai", "Homebox Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("设备总数", 180, 168);
  ctx.fillStyle = "#2f2d29";
  ctx.font = '500 46px "Homebox Manrope", "Segoe UI", sans-serif';
  ctx.fillText(
    String(scoped.value.reduce((n, i) => n + i.quantity, 0)),
    180,
    220,
  );
}
watch(stats, () => nextTick(draw), { deep: true });
watch(canvas, () => nextTick(draw));
onMounted(async () => {
  await refresh();
  draw();
  document.fonts.ready.then(draw);
});
function edit(i: EntityOut) {
  selected.value = i;
  editing.value = true;
}
</script>
<template>
  <div class="device-page">
    <div class="page-heading statistics-heading">
      <div>
        <h1>资产统计</h1>
        <p>截至 {{ new Date().toLocaleDateString("zh-CN") }}</p>
      </div>
      <div class="actions">
        <select v-model="scope" aria-label="统计范围">
          <option>全部设备</option>
          <option>不含已归档</option>
        </select>
        <select v-model="year" aria-label="统计年份">
          <option v-for="y in years" :key="y" :value="y">
            {{ y }} 年
          </option></select
        ><button
          class="btn"
          :disabled="loading || !!error"
          @click="downloadCSV(scoped, 'homebox-assets.csv')"
        >
          <Download :size="16" />导出
        </button>
      </div>
    </div>
    <div v-if="error" class="notice" role="alert">
      {{ error }}<button @click="refresh">重试</button>
    </div>
    <div v-if="loading" class="loading-line" role="status">
      正在计算资产统计…
    </div>
    <template v-if="ready && !error">
      <section class="metrics">
        <div class="metric">
          <label
            >设备购入总额
            <button
              type="button"
              class="metric-info"
              aria-label="统计口径"
              title="购入总额为单价乘数量，并非当前估值。全部设备包含已售出与已归档记录。没有购入日期的设备不计入年度支出。"
            >
              <Info :size="14" /></button></label
          ><strong>{{ formatMoney(stats.total / 100) }}</strong
          ><small
            >{{ scoped.reduce((n, i) => n + i.quantity, 0) }} 件设备</small
          >
        </div>
        <div class="metric">
          <label>{{ year }} 年购入支出</label
          ><strong>{{ formatMoney(stats.yearTotal / 100) }}</strong
          ><small>按购入日期统计</small>
        </div>
        <div class="metric">
          <label>在用设备</label
          ><strong
            >{{ stats.inUse }}
            <span style="font-size: 14px; font-weight: 400">件</span></strong
          ><small>当前使用中</small>
        </div>
        <div class="metric">
          <label>闲置设备</label
          ><strong
            >{{ stats.idle }}
            <span style="font-size: 14px; font-weight: 400">件</span></strong
          ><small>暂未使用</small>
        </div>
      </section>
      <div class="chart-columns">
        <section>
          <h2>
            月度购入支出
            <small
              style="
                font-size: 12px;
                color: var(--muted);
                font-weight: 400;
                margin-left: 12px;
              "
              >{{ year }}</small
            >
          </h2>
          <div class="bar-chart-frame">
            <div class="chart-axis" aria-hidden="true">
              <span>{{ (max / 100).toLocaleString("zh-CN") }}</span
              ><span>{{ (max / 200).toLocaleString("zh-CN") }}</span
              ><span>0</span>
            </div>
            <div
              class="bar-chart"
              role="group"
              :aria-label="`${year}年月度支出：${stats.months.map((v, i) => i + 1 + '月 ' + formatMoney(v / 100)).join('，')}`"
            >
              <button
                v-for="(c, i) in stats.months"
                :key="i"
                type="button"
                class="bar-column month-bar"
                :aria-label="`查看 ${year} 年 ${i + 1} 月购入明细：${formatMoney(c / 100)}`"
                :aria-pressed="purchasePeriod === i + 1"
                aria-controls="purchase-details"
                :title="`${i + 1}月：${formatMoney(c / 100)}`"
                @click="purchasePeriod = i + 1"
              >
                <div class="bar" :style="{ height: `${(c / max) * 210}px` }" />
                <span>{{ i + 1 }}<span class="month-unit">月</span></span>
              </button>
            </div>
          </div>
          <p style="font-size: 12px; color: var(--muted); margin-top: 14px">
            {{
              stats.undated
                ? `${stats.undated} 件设备未记录购入日期`
                : "购入日期已完整记录"
            }}
          </p>
        </section>
        <section>
          <h2>分类金额占比</h2>
          <div class="donut-wrap">
            <canvas
              ref="canvas"
              width="360"
              height="360"
              role="img"
              :aria-label="
                stats.byCategory
                  .map((c) => `${c.name} ${formatMoney(c.cents / 100)}`)
                  .join('，')
              "
            />
            <div class="chart-legend">
              <div
                v-for="(c, i) in stats.byCategory"
                :key="c.name"
                class="legend-row"
              >
                <i :style="{ background: categoryColors[i] }" /><span>{{
                  c.name
                }}</span
                ><strong>{{ formatMoney(c.cents / 100) }}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>
      <PurchaseDetails
        v-model:period="purchasePeriod"
        :items="scoped"
        :year="Number(year)"
        :loading="loading"
        @open="edit"
      />
      <div class="section-heading">
        <h2>最近购入</h2>
        <NuxtLink
          to="/devices"
          style="font-size: 13px; color: var(--accent-strong)"
          >查看全部</NuxtLink
        >
      </div>
      <DeviceTable v-if="recent.length" :items="recent" @edit="edit" />
      <div v-else class="empty-state" style="min-height: 140px">
        <p>暂无已记录购入日期的设备</p>
      </div> </template
    ><Editor v-if="editing" :item="selected" @close="editing = false" />
  </div>
</template>

<style scoped>
.month-bar {
  padding: 0 0 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-compact);
  background: transparent;
  transition:
    background-color 160ms,
    border-color 160ms;
}
.month-bar:hover {
  background: #65889b0c;
}
.month-bar[aria-pressed="true"] {
  background: #d9775712;
  border-color: #d977572e;
}
.month-bar[aria-pressed="true"] > span {
  color: var(--accent-strong);
  font-weight: 600;
}
.month-bar[aria-pressed="true"] .bar {
  background: linear-gradient(180deg, #d97757, #ad4e31);
}
.month-bar:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
@media (forced-colors: active) {
  .month-bar[aria-pressed="true"] {
    border-color: Highlight;
  }
}
</style>

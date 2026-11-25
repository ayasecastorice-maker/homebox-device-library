<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import { useDeviceOrder } from "~/composables/use-device-order";
import { useDeviceDrag } from "~/composables/use-device-drag";
import {
  Plus,
  Search,
  Grid2X2,
  List,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  X,
} from "lucide-vue-next";
import Editor from "~/components/Device/Editor.vue";
import DeviceTable from "~/components/Device/Table.vue";
import GlassSurface from "~/components/Device/GlassSurface.vue";
import OrderControls from "~/components/Device/OrderControls.vue";
import SelectionIndicator from "~/components/Device/SelectionIndicator.vue";
import {
  deviceSortOptions,
  moveDeviceInSubset,
  type DeviceSort,
} from "~/lib/device-order";
import type { EntityOut } from "~/lib/api/types/data-contracts";
import {
  categories,
  statuses,
  category,
  status,
  costCents,
} from "~/lib/devices";
definePageMeta({
  layout: "device",
  middleware: ["auth"],
  pageTransition: { name: "device-page", mode: "out-in" },
});
useHead({ title: "设备照片库 · Homebox" });
const { items, groups, loading, ready, error, refresh, photo, formatMoney } =
  useDeviceLibrary();
const query = ref(""),
  selectedCategory = ref("全部"),
  selectedStatus = ref("全部状态");
const mode = ref("grid"),
  page = ref(1),
  editing = ref(false),
  selected = ref<EntityOut | null>(null);
const pageSize = 9;
const {
  display,
  loaded: orderLoaded,
  saving,
  orderError,
  ordered,
  manualIds,
  loadOrder,
  saveOrder,
} = useDeviceOrder(items, selectedCategory);
const filtered = computed(() =>
  ordered.value.filter(
    (i) =>
      (selectedCategory.value === "全部" ||
        category(i) === selectedCategory.value) &&
      (selectedStatus.value === "全部状态" ||
        status(i) === selectedStatus.value) &&
      [
        i.name,
        i.manufacturer,
        i.modelNumber,
        i.serialNumber,
        i.description,
        ...i.tags.map((t) => t.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
const pages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize)),
);
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
);
watch([query, selectedCategory, selectedStatus], () => {
  page.value = 1;
});
watch(pages, (p) => {
  page.value = Math.min(page.value, p);
});
const grid = ref<ComponentPublicInstance>();
const canReorder = computed(
  () =>
    display.value.sort === "manual" &&
    orderLoaded.value &&
    !saving.value &&
    !loading.value,
);
const { dragging } = useDeviceDrag(grid, canReorder, moveVisible);
function edit(item: EntityOut | null = null) {
  if (dragging.value) return;
  selected.value = item;
  editing.value = true;
}
function groupNames(item: EntityOut) {
  return (
    item.tags
      .filter((t) => groups.value.some((g) => g.id === t.id))
      .map((t) => t.name)
      .join(" / ") || "未分组"
  );
}
async function reloadLibrary() {
  await refresh();
  await loadOrder();
}
async function selectSort(event: Event) {
  await saveOrder((event.target as HTMLSelectElement).value as DeviceSort);
  page.value = 1;
}
async function moveTo(id: string, target: number) {
  if (!canReorder.value) return false;
  const keyboardTarget = document.activeElement;
  const restoreKeyboardFocus =
    keyboardTarget?.classList.contains("device-order-grip");
  const next = moveDeviceInSubset(
    manualIds.value,
    filtered.value.map((i) => i.id),
    id,
    target,
  );
  if (!(await saveOrder("manual", next))) return false;
  page.value = Math.floor(target / pageSize) + 1;
  await nextTick();
  if (restoreKeyboardFocus) {
    focusTimer = setTimeout(() => {
      if (
        document.activeElement === document.body ||
        document.activeElement === keyboardTarget
      ) {
        document
          .querySelector<HTMLButtonElement>(
            `[data-device-id="${id}"] .device-order-grip`,
          )
          ?.focus();
      }
    }, 220);
  }
  return true;
}
let focusTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(focusTimer));
function moveVisible(from: number, to: number) {
  const item = visible.value[from];
  if (item) void moveTo(item.id, (page.value - 1) * pageSize + to);
}
const positionItem = ref<EntityOut | null>(null),
  positionValue = ref(1);
const positionDialog = ref<HTMLDialogElement>();
const { open: openPositionDialog, close: closePositionDialog } =
  useDeviceDialog(positionDialog);
async function pickPosition(item: EntityOut) {
  positionItem.value = item;
  positionValue.value = filtered.value.findIndex((i) => i.id === item.id) + 1;
  await nextTick();
  openPositionDialog();
}
async function applyPosition() {
  if (
    !positionItem.value ||
    !Number.isInteger(positionValue.value) ||
    positionValue.value < 1 ||
    positionValue.value > filtered.value.length
  )
    return;
  if (await moveTo(positionItem.value.id, positionValue.value - 1))
    await closePositionDialog();
}
onMounted(reloadLibrary);
</script>
<template>
  <div class="device-page">
    <div class="page-heading">
      <div>
        <h1>设备照片库</h1>
        <p>
          {{ items.reduce((n, i) => n + i.quantity, 0) }} 件设备 ·
          {{
            items
              .filter((i) => status(i) === "在用")
              .reduce((n, i) => n + i.quantity, 0)
          }}
          件在用 ·
          {{
            items
              .filter((i) => status(i) === "闲置")
              .reduce((n, i) => n + i.quantity, 0)
          }}
          件闲置
        </p>
      </div>
      <button class="btn primary" :disabled="!ready || loading" @click="edit()">
        <Plus :size="18" />添加设备
      </button>
    </div>
    <div class="toolbar device-library-toolbar">
      <GlassSurface />
      <label class="search-input"
        ><Search :size="19" /><input
          v-model="query"
          aria-label="搜索设备"
          placeholder="搜索名称、型号或分组" /></label
      ><select v-model="selectedStatus" aria-label="筛选状态">
        <option>全部状态</option>
        <option v-for="s in statuses" :key="s">{{ s }}</option>
      </select>
      <select
        :value="display.sort"
        aria-label="设备排序"
        :disabled="!orderLoaded || saving || loading"
        @change="selectSort"
      >
        <option
          v-for="option in deviceSortOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <div class="view-switch" role="group" aria-label="设备视图">
        <SelectionIndicator :active="mode" />
        <button
          class="icon-button"
          :class="{ active: mode === 'grid' }"
          :aria-pressed="mode === 'grid'"
          aria-label="照片视图"
          title="照片视图"
          @click="mode = 'grid'"
        >
          <Grid2X2 :size="18" /></button
        ><button
          class="icon-button"
          :class="{ active: mode === 'list' }"
          :aria-pressed="mode === 'list'"
          aria-label="列表视图"
          title="列表视图"
          @click="mode = 'list'"
        >
          <List :size="19" />
        </button>
      </div>
      <button
        class="icon-button"
        title="刷新"
        aria-label="刷新"
        :disabled="loading || saving"
        @click="reloadLibrary"
      >
        <RefreshCw :size="17" />
      </button>
    </div>
    <div v-if="orderError" class="notice" role="alert">
      {{ orderError }}<button @click="loadOrder">重试</button>
    </div>
    <span class="sr-only" role="status" aria-live="polite">{{
      saving ? "正在保存排序" : ""
    }}</span>
    <div class="category-tabs" aria-label="设备分类">
      <SelectionIndicator :active="selectedCategory" />
      <button
        v-for="c in ['全部', ...categories]"
        :key="c"
        :class="{ active: selectedCategory === c }"
        :aria-pressed="selectedCategory === c"
        :disabled="saving || dragging"
        @click="selectedCategory = c"
      >
        {{ c
        }}<small>{{
          c === "全部"
            ? items.length
            : items.filter((i) => category(i) === c).length
        }}</small>
      </button>
    </div>
    <div v-if="error" class="notice" role="alert">
      {{ error }}<button @click="reloadLibrary">重试</button>
    </div>
    <div v-if="loading" class="loading-line" role="status">正在读取设备…</div>
    <template v-else-if="!error">
      <Transition name="device-content" mode="out-in">
        <div
          :key="`${mode}:${selectedCategory}:${selectedStatus}:${page}`"
          class="device-results"
        >
          <div v-if="!filtered.length" class="empty-state">
            <ImageIcon :size="40" :stroke-width="1.2" />
            <h2>
              {{ items.length ? "没有符合条件的设备" : "设备库还是空的" }}
            </h2>
            <p>
              {{
                items.length ? "试试其他名称或筛选条件" : "从你的第一件设备开始"
              }}
            </p>
            <button v-if="!items.length" class="btn primary" @click="edit()">
              <Plus :size="17" />添加设备
            </button>
          </div>
          <TransitionGroup
            ref="grid"
            v-else-if="mode === 'grid'"
            name="device-tile"
            tag="div"
            class="device-grid"
          >
            <article
              v-for="(item, index) in visible"
              :key="item.id"
              class="device-card"
              :data-device-id="item.id"
              :style="{ '--tile-index': index }"
            >
              <button
                class="device-card-open"
                :aria-label="`编辑 ${item.name}`"
                @click="edit(item)"
              >
                <div class="device-photo">
                  <img
                    v-if="photo(item)"
                    :src="photo(item)"
                    :alt="item.name"
                    loading="lazy"
                  /><ImageIcon v-else :size="42" :stroke-width="1.2" />
                </div>
                <div class="device-card-copy">
                  <h2>{{ item.name }}</h2>
                  <div class="description">
                    {{
                      item.description ||
                      [item.manufacturer, item.modelNumber]
                        .filter(Boolean)
                        .join(" / ") ||
                      "未填写规格"
                    }}
                  </div>
                  <div class="card-line">
                    <strong>{{ formatMoney(costCents(item) / 100) }}</strong
                    ><span class="status-chip" :data-status="status(item)">{{
                      status(item)
                    }}</span>
                  </div>
                  <div class="card-groups">
                    <MapPin :size="13" />{{ groupNames(item)
                    }}<span v-if="item.quantity > 1">
                      · {{ item.quantity }} 件</span
                    >
                  </div>
                </div>
              </button>
              <OrderControls
                v-if="display.sort === 'manual'"
                :name="item.name"
                :index="(page - 1) * pageSize + index"
                :total="filtered.length"
                :disabled="!canReorder"
                @move="moveTo(item.id, $event)"
                @position="pickPosition(item)"
              />
            </article>
          </TransitionGroup>
          <DeviceTable
            v-else
            :items="visible"
            :sortable="display.sort === 'manual'"
            :sort-disabled="!canReorder"
            :offset="(page - 1) * pageSize"
            :total="filtered.length"
            @edit="edit"
            @reorder="moveVisible"
            @move="moveTo"
            @position="pickPosition"
          />
        </div>
      </Transition>
      <div v-if="filtered.length" class="pagination">
        <span
          >显示 {{ (page - 1) * pageSize + 1 }}–{{
            Math.min(page * pageSize, filtered.length)
          }}，共 {{ filtered.length }} 条记录</span
        >
        <div>
          <button
            class="icon-button"
            :disabled="page === 1"
            aria-label="上一页"
            @click="page--"
          >
            <ChevronLeft :size="16" /></button
          ><span>{{ page }} / {{ pages }}</span
          ><button
            class="icon-button"
            :disabled="page === pages"
            aria-label="下一页"
            @click="page++"
          >
            <ChevronRight :size="16" />
          </button>
        </div>
      </div>
    </template>
    <Editor v-if="editing" :item="selected" @close="editing = false" />
    <dialog
      ref="positionDialog"
      class="device-dialog order-position-dialog"
      @cancel.prevent="closePositionDialog()"
    >
      <form @submit.prevent="applyPosition">
        <header class="dialog-head">
          <GlassSurface />
          <h2>调整位置</h2>
          <button
            type="button"
            class="icon-button"
            aria-label="关闭"
            @click="closePositionDialog()"
          >
            <X :size="19" />
          </button>
        </header>
        <div class="dialog-body">
          <p class="position-device-name">{{ positionItem?.name }}</p>
          <label class="position-field"
            >位置<input
              v-model.number="positionValue"
              type="number"
              min="1"
              :max="filtered.length"
              step="1"
              required
              :disabled="saving"
          /></label>
          <div v-if="orderError" class="notice" role="alert">
            {{ orderError }}
          </div>
        </div>
        <footer class="dialog-foot">
          <GlassSurface /><button
            type="button"
            class="btn"
            :disabled="saving"
            @click="closePositionDialog()"
          >
            取消</button
          ><button type="submit" class="btn primary" :disabled="saving">
            {{ saving ? "保存中…" : "移动" }}
          </button>
        </footer>
      </form>
    </dialog>
  </div>
</template>

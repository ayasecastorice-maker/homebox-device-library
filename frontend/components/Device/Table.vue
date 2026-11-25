<script setup lang="ts">
import { ImageIcon, Pencil, Unlink } from "lucide-vue-next";
import type { EntityOut } from "~/lib/api/types/data-contracts";
import { category, status, costCents, dateOnly } from "~/lib/devices";
import OrderControls from "./OrderControls.vue";
import { useDeviceDrag } from "~/composables/use-device-drag";
const props = withDefaults(
  defineProps<{
    items: EntityOut[];
    removable?: boolean;
    sortable?: boolean;
    sortDisabled?: boolean;
    offset?: number;
    total?: number;
  }>(),
  { offset: 0, total: 0 },
);
const emit = defineEmits<{
  edit: [item: EntityOut];
  remove: [item: EntityOut];
  reorder: [from: number, to: number];
  move: [id: string, target: number];
  position: [item: EntityOut];
}>();
const { photo, formatMoney } = useDeviceLibrary();
const rows = ref<HTMLElement>();
useDeviceDrag(
  rows,
  computed(() => !!props.sortable && !props.sortDisabled),
  (from, to) => emit("reorder", from, to),
);
</script>
<template>
  <div class="table-wrap">
    <table class="device-table">
      <thead>
        <tr>
          <th>设备</th>
          <th>分类</th>
          <th>状态</th>
          <th>购入金额</th>
          <th>购入日期</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody ref="rows">
        <tr
          v-for="(item, index) in items"
          :key="item.id"
          :data-device-id="item.id"
        >
          <td>
            <button class="table-device" @click="emit('edit', item)">
              <img
                v-if="photo(item)"
                :src="photo(item)"
                :alt="item.name"
                loading="lazy"
              /><span v-else class="table-thumb"><ImageIcon :size="20" /></span
              ><span
                ><strong>{{ item.name }}</strong
                ><small
                  >{{ item.modelNumber || item.description || "—"
                  }}{{
                    item.quantity > 1 ? ` · ${item.quantity} 件` : ""
                  }}</small
                ></span
              >
            </button>
          </td>
          <td>{{ category(item) }}</td>
          <td>
            <span class="status-chip" :data-status="status(item)">{{
              status(item)
            }}</span>
          </td>
          <td class="data-text">{{ formatMoney(costCents(item) / 100) }}</td>
          <td class="data-text">
            {{ dateOnly(item.purchaseDate) || "未记录" }}
          </td>
          <td>
            <div class="actions">
              <OrderControls
                v-if="sortable"
                :name="item.name"
                :index="offset + index"
                :total="total"
                :disabled="sortDisabled"
                @move="emit('move', item.id, $event)"
                @position="emit('position', item)"
              />
              <button
                class="icon-button"
                :aria-label="`编辑 ${item.name}`"
                title="编辑设备"
                @click="emit('edit', item)"
              >
                <Pencil :size="16" /></button
              ><button
                v-if="removable"
                class="icon-button"
                :aria-label="`从分组移除 ${item.name}`"
                title="从分组移除"
                @click="emit('remove', item)"
              >
                <Unlink :size="16" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

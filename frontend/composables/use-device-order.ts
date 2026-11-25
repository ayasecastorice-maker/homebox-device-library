import type { Ref } from "vue";
import type { EntityOut } from "~/lib/api/types/data-contracts";
import {
  manualDeviceOrder,
  sortDevices,
  deviceArrangement,
  normalizeDeviceDisplay,
  updateDeviceArrangement,
  type DeviceDisplay,
  type DeviceSort,
} from "~/lib/device-order";
import { category } from "~/lib/devices";

export function useDeviceOrder(items: Ref<EntityOut[]>, scope: Ref<string>) {
  const api = useUserApi();
  const state = ref<DeviceDisplay>({ sort: "manual", order: [], revision: 0 });
  const loaded = ref(false),
    saving = ref(false),
    orderError = ref("");
  const display = computed(() => deviceArrangement(state.value, scope.value));
  const scopedItems = computed(() =>
    scope.value === "全部"
      ? items.value
      : items.value.filter((item) => category(item) === scope.value),
  );
  const ordered = computed(() =>
    sortDevices(scopedItems.value, display.value.sort, display.value.order),
  );
  const manualIds = computed(() =>
    manualDeviceOrder(scopedItems.value, display.value.order),
  );
  async function loadOrder() {
    if (saving.value) return;
    loaded.value = false;
    try {
      const result = await api.user.getDeviceDisplay();
      if (result.error) throw new Error();
      state.value = normalizeDeviceDisplay(items.value, result.data.item);
      loaded.value = true;
      orderError.value = "";
    } catch {
      orderError.value = "排序设置读取失败，请重试。设备信息不受影响。";
    }
  }
  async function saveOrder(sort: DeviceSort, order = manualIds.value) {
    if (!loaded.value || saving.value) return false;
    const previous = state.value;
    saving.value = true;
    orderError.value = "";
    state.value = updateDeviceArrangement(
      items.value,
      previous,
      scope.value,
      sort,
      order,
    );
    try {
      const result = await api.user.setDeviceDisplay(state.value);
      if (result.error) {
        state.value = previous;
        if (result.status === 409) {
          const latest = await api.user.getDeviceDisplay();
          if (!latest.error)
            state.value = normalizeDeviceDisplay(items.value, latest.data.item);
          orderError.value = "排序已在其他窗口更新，请重试。";
          return false;
        }
        throw new Error();
      }
      state.value = normalizeDeviceDisplay(items.value, result.data.item);
      return true;
    } catch {
      state.value = previous;
      orderError.value = "排序未能保存，已恢复之前的顺序。请重试。";
      return false;
    } finally {
      saving.value = false;
    }
  }
  return {
    state,
    display,
    loaded,
    saving,
    orderError,
    ordered,
    manualIds,
    loadOrder,
    saveOrder,
  };
}

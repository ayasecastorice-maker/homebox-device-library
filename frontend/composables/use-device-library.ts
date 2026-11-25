import type {
  EntityOut,
  EntityTypeSummary,
  TagOut,
} from "~/lib/api/types/data-contracts";
import { GROUP_ICON } from "~/lib/devices";

export function useDeviceLibrary() {
  const api = useUserApi();
  const auth = useAuthContext();
  const prefs = useViewPreferences();
  const key = `${auth.user?.id || "anonymous"}:${prefs.value.collectionId || auth.user?.defaultGroupId || ""}`;
  const items = useState<EntityOut[]>(`devices:${key}`, () => []);
  const tags = useState<TagOut[]>(`device-tags:${key}`, () => []);
  const types = useState<EntityTypeSummary[]>(`device-types:${key}`, () => []);
  const loading = useState(`device-loading:${key}`, () => false);
  const ready = useState(`device-ready:${key}`, () => false);
  const error = useState(`device-error:${key}`, () => "");
  const groups = computed(() =>
    tags.value.filter((t) => t.icon === GROUP_ICON),
  );
  const currency = useState(`device-currency:${key}`, () => "CNY");
  async function refresh() {
    if (loading.value) return;
    loading.value = true;
    error.value = "";
    try {
      const tagResult = await api.tags.getAll();
      if (tagResult.error) throw new Error("无法读取装备分组");
      const typeResult = await api.entityTypes.getAll();
      if (typeResult.error) throw new Error("无法读取设备类型");
      const workspace = await api.group.get();
      if (workspace.error) throw new Error("无法读取资产币种");
      currency.value = workspace.data.currency || "CNY";
      const all: EntityOut[] = [];
      let page = 1;
      while (true) {
        const result = await api.items.getAll({
          page,
          pageSize: 100,
          includeArchived: true,
          orderBy: "id",
          orderDirection: "asc",
        });
        if (result.error || !result.data) throw new Error("无法读取设备列表");
        for (const summary of result.data.items) {
          if (summary.entityType?.isLocation) continue;
          const detail = await api.items.get(summary.id);
          if (detail.error || !detail.data)
            throw new Error("部分设备详情读取失败，请重试");
          all.push(detail.data);
        }
        if (
          page * result.data.pageSize >= result.data.total ||
          !result.data.items.length
        )
          break;
        page++;
      }
      tags.value = tagResult.data || [];
      types.value = typeResult.data || [];
      items.value = all;
      ready.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "连接失败，请检查本地服务";
    } finally {
      loading.value = false;
    }
  }
  function photo(item: EntityOut, attachmentId?: string) {
    const id = attachmentId || item.imageId;
    return id ? api.authURL(`/entities/${item.id}/attachments/${id}`) : "";
  }
  const formatMoney = (v: number) =>
    new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: currency.value,
    }).format(v);
  return {
    api,
    items,
    tags,
    types,
    groups,
    loading,
    ready,
    error,
    refresh,
    photo,
    currency,
    formatMoney,
  };
}

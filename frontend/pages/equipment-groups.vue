<script setup lang="ts">
import {
  Plus,
  Layers,
  ImageIcon,
  Pencil,
  X,
  Save,
  Trash2,
  Search,
} from "lucide-vue-next";
import DeviceTable from "~/components/Device/Table.vue";
import Editor from "~/components/Device/Editor.vue";
import GlassSurface from "~/components/Device/GlassSurface.vue";
import type { EntityOut, TagOut } from "~/lib/api/types/data-contracts";
import { groupMeta, costCents, GROUP_ICON } from "~/lib/devices";
definePageMeta({
  layout: "device",
  middleware: ["auth"],
  pageTransition: { name: "device-page", mode: "out-in" },
});
useHead({ title: "装备分组 · Homebox" });
const {
  api,
  items,
  groups,
  loading,
  ready,
  error,
  refresh,
  photo,
  formatMoney,
} = useDeviceLibrary();
const activeId = ref("");
const active = computed(
  () => groups.value.find((g) => g.id === activeId.value) || groups.value[0],
);
const members = (id: string) =>
  items.value.filter((i) => i.tags.some((t) => t.id === id));
const total = (id: string) =>
  members(id).reduce((n, i) => n + costCents(i), 0) / 100;
function cover(g: TagOut) {
  const list = members(g.id);
  const item =
    list.find((i) => i.id === groupMeta(g).coverId && i.imageId) ||
    list.find((i) => i.imageId);
  return item ? photo(item) : "";
}
const dialog = ref<HTMLDialogElement>(),
  memberDialog = ref<HTMLDialogElement>();
const groupMotion = useDeviceDialog(dialog);
const memberMotion = useDeviceDialog(memberDialog);
const busy = ref(false),
  localError = ref(""),
  groupId = ref("");
const form = reactive({ name: "", description: "", coverId: "" });
const selectedMembers = ref<string[]>([]),
  memberQuery = ref("");
const memberOptions = computed(() =>
  items.value.filter((i) =>
    i.name.toLowerCase().includes(memberQuery.value.toLowerCase()),
  ),
);
const selected = ref<EntityOut | null>(null),
  editing = ref(false);
onMounted(refresh);
function editItem(i: EntityOut) {
  selected.value = i;
  editing.value = true;
}
function editGroup(g?: TagOut) {
  groupId.value = g?.id || "";
  form.name = g?.name || "";
  form.description = g ? groupMeta(g).description : "";
  form.coverId = g ? groupMeta(g).coverId : "";
  localError.value = "";
  groupMotion.open();
}
function closeGroup() {
  if (!busy.value) void groupMotion.close();
}
async function saveGroup() {
  busy.value = true;
  localError.value = "";
  try {
    const body = {
      name: form.name.trim(),
      description: JSON.stringify({
        version: 1,
        description: form.description,
        coverId: form.coverId,
      }),
      color: "#3d795a",
      icon: GROUP_ICON,
    };
    const result = groupId.value
      ? await api.tags.update(groupId.value, body)
      : await api.tags.create(body);
    if (result.error) throw new Error("分组保存失败，请检查名称是否重复");
    activeId.value = result.data.id;
    await refresh();
    await groupMotion.close();
  } catch (e) {
    localError.value = e instanceof Error ? e.message : "保存失败";
  } finally {
    busy.value = false;
  }
}
async function deleteGroup() {
  if (
    !groupId.value ||
    !window.confirm("删除这个装备分组？设备和照片会保留，只解除分组关系。")
  )
    return;
  busy.value = true;
  try {
    const r = await api.tags.delete(groupId.value);
    if (r.error) throw new Error();
    await refresh();
    await groupMotion.close();
  } catch {
    localError.value = "删除失败，请重试";
  } finally {
    busy.value = false;
  }
}
function pickMembers() {
  if (!active.value) return;
  selectedMembers.value = members(active.value.id).map((i) => i.id);
  memberQuery.value = "";
  localError.value = "";
  memberMotion.open();
}
function closeMembers() {
  if (!busy.value) void memberMotion.close();
}
async function membership(item: EntityOut, id: string, add: boolean) {
  const fresh = await api.items.get(item.id);
  if (fresh.error) throw new Error(`无法读取 ${item.name}`);
  const ids = fresh.data.tags.filter((t) => t.id !== id).map((t) => t.id);
  if (add) ids.push(id);
  const r = await api.items.patch(item.id, { id: item.id, tagIds: ids });
  if (r.error) throw new Error(`${item.name} 的分组更新失败`);
}
async function saveMembers() {
  if (!active.value) return;
  busy.value = true;
  localError.value = "";
  try {
    for (const item of items.value) {
      const before = item.tags.some((t) => t.id === active.value!.id),
        after = selectedMembers.value.includes(item.id);
      if (before !== after) await membership(item, active.value.id, after);
    }
    await refresh();
    await memberMotion.close();
  } catch (e) {
    await refresh();
    localError.value =
      (e instanceof Error ? e.message : "更新失败") +
      "。已完成的修改已保留，可重试其余修改。";
  } finally {
    busy.value = false;
  }
}
async function removeMember(item: EntityOut) {
  if (
    !active.value ||
    !window.confirm(`将“${item.name}”移出这个分组？设备不会被删除。`)
  )
    return;
  try {
    await membership(item, active.value.id, false);
    await refresh();
  } catch (e) {
    localError.value = e instanceof Error ? e.message : "移除失败";
  }
}
</script>
<template>
  <div class="device-page">
    <div class="page-heading">
      <div>
        <h1>装备分组</h1>
        <p>
          {{ groups.length }} 个分组 ·
          {{
            items.filter((i) =>
              i.tags.some((t) => groups.some((g) => g.id === t.id)),
            ).length
          }}
          条设备记录已分组
        </p>
      </div>
      <button
        class="btn primary"
        :disabled="!ready || loading"
        @click="editGroup()"
      >
        <Plus :size="18" />新建分组
      </button>
    </div>
    <div v-if="error" class="notice" role="alert">
      {{ error }}<button @click="refresh">重试</button>
    </div>
    <div
      v-if="localError && !dialog?.open && !memberDialog?.open"
      class="notice"
      role="alert"
    >
      {{ localError }}
    </div>
    <div v-if="loading" class="loading-line">正在读取分组…</div>
    <template v-else-if="!error">
      <div v-if="!groups.length" class="empty-state">
        <Layers :size="40" :stroke-width="1.2" />
        <h2>还没有装备分组</h2>
        <p>工作桌、随身装备，或你的下一个组合</p>
        <button class="btn primary" @click="editGroup()">
          <Plus :size="17" />新建分组
        </button>
      </div>
      <div v-else class="group-grid">
        <button
          v-for="(g, index) in groups"
          :key="g.id"
          class="group-card"
          :style="{ '--tile-index': index }"
          :class="{ selected: active?.id === g.id }"
          :aria-pressed="active?.id === g.id"
          @click="activeId = g.id"
        >
          <div class="device-photo">
            <img
              v-if="cover(g)"
              :src="cover(g)"
              :alt="`${g.name}封面`"
            /><ImageIcon v-else :size="38" :stroke-width="1.2" />
          </div>
          <div class="group-card-copy">
            <h2>{{ g.name }}</h2>
            <p>{{ groupMeta(g).description || "暂无分组描述" }}</p>
            <footer>
              <span
                >{{
                  members(g.id).reduce((n, i) => n + i.quantity, 0)
                }}
                件设备</span
              ><span>{{ formatMoney(total(g.id)) }}</span>
            </footer>
          </div>
        </button>
      </div>
      <Transition name="device-content" mode="out-in"
        ><div v-if="active" :key="active.id">
          <div class="section-heading">
            <div>
              <h2>{{ active.name }}</h2>
              <p>{{ groupMeta(active).description }}</p>
            </div>
            <div class="actions">
              <button class="btn" @click="editGroup(active)">
                <Pencil :size="15" />编辑分组</button
              ><button class="btn primary" @click="pickMembers">
                <Plus :size="16" />管理设备
              </button>
            </div>
          </div>
          <DeviceTable
            v-if="members(active.id).length"
            :items="members(active.id)"
            removable
            @edit="editItem"
            @remove="removeMember"
          />
          <div v-else class="empty-state" style="min-height: 180px">
            <p>这个分组还没有设备</p>
            <button class="btn" @click="pickMembers">
              <Plus :size="16" />管理设备
            </button>
          </div>
        </div></Transition
      >
    </template>
    <dialog
      ref="dialog"
      class="device-dialog"
      aria-labelledby="group-title"
      @cancel.prevent="closeGroup"
    >
      <form @submit.prevent="saveGroup">
        <div class="dialog-head">
          <GlassSurface />
          <h2 id="group-title">{{ groupId ? "编辑分组" : "新建分组" }}</h2>
          <button
            class="icon-button"
            type="button"
            :disabled="busy"
            aria-label="关闭"
            @click="closeGroup"
          >
            <X :size="18" />
          </button>
        </div>
        <div class="dialog-body">
          <div v-if="localError" class="notice" role="alert">
            {{ localError }}
          </div>
          <fieldset :disabled="busy" class="form-grid">
            <label class="full"
              >分组名称<input
                v-model="form.name"
                required
                maxlength="255"
                autofocus /></label
            ><label class="full"
              >分组描述<textarea
                v-model="form.description"
                maxlength="400"
              /></label
            ><label v-if="groupId" class="full"
              >封面照片<select v-model="form.coverId">
                <option value="">自动使用组内设备照片</option>
                <option
                  v-for="i in members(groupId).filter((i) => i.imageId)"
                  :key="i.id"
                  :value="i.id"
                >
                  {{ i.name }}
                </option>
              </select></label
            >
          </fieldset>
        </div>
        <div class="dialog-foot">
          <GlassSurface />
          <button
            v-if="groupId"
            class="btn danger"
            type="button"
            :disabled="busy"
            @click="deleteGroup"
          >
            <Trash2 :size="16" />删除分组</button
          ><button class="btn primary" :disabled="busy">
            <Save :size="16" />{{ busy ? "保存中…" : "保存分组" }}
          </button>
        </div>
      </form>
    </dialog>
    <dialog
      ref="memberDialog"
      class="device-dialog"
      aria-labelledby="members-title"
      @cancel.prevent="closeMembers"
    >
      <form @submit.prevent="saveMembers">
        <div class="dialog-head">
          <GlassSurface />
          <h2 id="members-title">{{ active?.name }} · 管理设备</h2>
          <button
            class="icon-button"
            type="button"
            :disabled="busy"
            aria-label="关闭"
            @click="closeMembers"
          >
            <X :size="18" />
          </button>
        </div>
        <div class="dialog-body">
          <div v-if="localError" class="notice" role="alert">
            {{ localError }}
          </div>
          <label class="search-input"
            ><Search :size="18" /><input
              v-model="memberQuery"
              placeholder="搜索设备"
              aria-label="搜索分组成员"
          /></label>
          <div class="member-picker">
            <label v-for="i in memberOptions" :key="i.id"
              ><input
                v-model="selectedMembers"
                type="checkbox"
                :value="i.id"
                :disabled="busy"
              /><img
                v-if="photo(i)"
                :src="photo(i)"
                :alt="i.name"
                style="width: 48px; height: 38px; object-fit: contain"
              /><span>{{ i.name }}</span></label
            >
            <p v-if="!memberOptions.length" style="color: var(--muted)">
              暂无可选设备
            </p>
          </div>
        </div>
        <div class="dialog-foot">
          <GlassSurface />
          <span style="margin-right: auto; color: var(--muted)"
            >已选 {{ selectedMembers.length }} 条记录</span
          ><button class="btn primary" :disabled="busy">
            <Save :size="16" />{{ busy ? "保存中…" : "保存成员" }}
          </button>
        </div>
      </form>
    </dialog>
    <Editor v-if="editing" :item="selected" @close="editing = false" />
  </div>
</template>

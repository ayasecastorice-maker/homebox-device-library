<script setup lang="ts">
import GlassSurface from "~/components/Device/GlassSurface.vue";
import {
  X,
  Save,
  Trash2,
  ImagePlus,
  Star,
  ExternalLink,
} from "lucide-vue-next";
import type { EntityOut, ItemAttachment } from "~/lib/api/types/data-contracts";
import { AttachmentTypes } from "~/lib/api/types/non-generated";
import {
  categories,
  statuses,
  category,
  status,
  dateOnly,
  setTextField,
  updatePayload,
  CATEGORY_FIELD,
  STATUS_FIELD,
} from "~/lib/devices";
const props = defineProps<{ item?: EntityOut | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const { api, types, groups, refresh, photo } = useDeviceLibrary();
const dialog = ref<HTMLDialogElement>();
const dialogMotion = useDeviceDialog(dialog);
const saved = ref<EntityOut | null>(props.item || null);
const busy = ref(false),
  error = ref("");
const pending = ref<File[]>([]);
const f = reactive({
  name: props.item?.name || "",
  description: props.item?.description || "",
  manufacturer: props.item?.manufacturer || "",
  modelNumber: props.item?.modelNumber || "",
  serialNumber: props.item?.serialNumber || "",
  quantity: props.item?.quantity || 1,
  purchasePrice: props.item?.purchasePrice || 0,
  purchaseDate: dateOnly(props.item?.purchaseDate),
  purchaseFrom: props.item?.purchaseFrom || "",
  warrantyExpires: dateOnly(props.item?.warrantyExpires),
  warrantyDetails: props.item?.warrantyDetails || "",
  lifetimeWarranty: props.item?.lifetimeWarranty || false,
  notes: props.item?.notes || "",
  category: props.item ? category(props.item) : "电脑",
  status: props.item ? status(props.item) : "在用",
  soldDate: dateOnly(props.item?.soldDate),
  soldPrice: props.item?.soldPrice || 0,
  tagIds:
    props.item?.tags
      .filter((t) => groups.value.some((g) => g.id === t.id))
      .map((t) => t.id) || [],
});
const photos = computed(
  () => saved.value?.attachments?.filter((a) => a.type === "photo") || [],
);
onMounted(dialogMotion.open);
function close() {
  if (!busy.value) void dialogMotion.close(() => emit("close"));
}
function choose(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (
    files.some(
      (file) =>
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          file.type,
        ) || file.size > 10 * 1024 * 1024,
    )
  ) {
    error.value = "请选择 10 MB 以内的 JPG、PNG、WebP 或 GIF 照片";
    input.value = "";
    return;
  }
  pending.value.push(...files);
  input.value = "";
  error.value = "";
}
async function persist() {
  busy.value = true;
  error.value = "";
  try {
    let item = saved.value;
    if (!item) {
      const type = types.value.find((t) => !t.isLocation);
      if (!type) throw new Error("没有可用的设备类型，请先在原版设置中创建");
      const res = await api.items.create({
        name: f.name.trim(),
        description: f.description,
        manufacturer: f.manufacturer,
        modelNumber: f.modelNumber,
        quantity: Number(f.quantity),
        entityTypeId: type.id,
        tagIds: f.tagIds,
      });
      if (res.error || !res.data)
        throw new Error("创建设备失败，请检查名称与必填项");
      saved.value = item = res.data;
    }
    const latest = await api.items.get(item.id);
    if (latest.error || !latest.data)
      throw new Error("读取最新记录失败，请重试");
    const payload = updatePayload(latest.data);
    let fields = setTextField(payload.fields, CATEGORY_FIELD, f.category);
    fields = setTextField(fields, STATUS_FIELD, f.status);
    const otherTags = latest.data.tags
      .filter((t) => !groups.value.some((g) => g.id === t.id))
      .map((t) => t.id);
    const res = await api.items.update(item.id, {
      ...payload,
      name: f.name.trim(),
      description: f.description,
      manufacturer: f.manufacturer,
      modelNumber: f.modelNumber,
      serialNumber: f.serialNumber,
      quantity: Number(f.quantity),
      purchasePrice: Number(f.purchasePrice),
      purchaseDate: f.purchaseDate || "",
      purchaseFrom: f.purchaseFrom,
      warrantyExpires: f.warrantyExpires || "",
      warrantyDetails: f.warrantyDetails,
      lifetimeWarranty: f.lifetimeWarranty,
      notes: f.notes,
      fields,
      tagIds: [...otherTags, ...f.tagIds],
      archived: f.status === "已归档",
      soldDate:
        f.status === "已售出"
          ? f.soldDate || new Date().toISOString().slice(0, 10)
          : "",
      soldPrice: Number(f.soldPrice),
    });
    if (res.error || !res.data)
      throw new Error(
        "设备记录已创建，但详细信息保存失败；请重试保存，不会重复创建",
      );
    saved.value = res.data;
    while (pending.value.length) {
      const file = pending.value[0]!;
      const uploaded = await api.items.attachments.add(
        item.id,
        file,
        file.name,
        AttachmentTypes.Photo,
        !saved.value.imageId,
      );
      if (uploaded.error || !uploaded.data)
        throw new Error("资料已保存，但照片上传失败；请重试保存以继续上传");
      saved.value = uploaded.data;
      pending.value.shift();
    }
    await refresh();
    emit("saved");
    await dialogMotion.close(() => emit("close"));
  } catch (e) {
    error.value = e instanceof Error ? e.message : "保存失败，请重试";
  } finally {
    busy.value = false;
  }
}
async function changePhoto(attachment: ItemAttachment, remove = false) {
  if (
    !saved.value ||
    (remove && !window.confirm("删除这张照片？此操作无法撤销。"))
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    const r = remove
      ? await api.items.attachments.delete(saved.value.id, attachment.id)
      : await api.items.attachments.update(saved.value.id, attachment.id, {
          primary: true,
          title: attachment.title,
          type: "photo",
        });
    if (r.error) throw new Error("照片更新失败");
    const detail = await api.items.get(saved.value.id);
    if (detail.error) throw new Error("照片已更新，请重新打开设备以刷新");
    saved.value = detail.data;
    await refresh();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "照片更新失败";
  } finally {
    busy.value = false;
  }
}
async function removeDevice() {
  if (
    !saved.value ||
    !window.confirm(
      `永久删除“${saved.value.name}”和它的全部照片？此操作无法撤销。`,
    )
  )
    return;
  busy.value = true;
  try {
    const r = await api.items.delete(saved.value.id);
    if (r.error) throw new Error("删除失败");
    await refresh();
    emit("saved");
    await dialogMotion.close(() => emit("close"));
  } catch {
    error.value = "删除失败，请重试";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <dialog
    ref="dialog"
    class="device-dialog device-editor-dialog"
    aria-labelledby="device-editor-title"
    @cancel.prevent="close"
  >
    <form @submit.prevent="persist">
      <div class="dialog-head">
        <GlassSurface />
        <h2 id="device-editor-title">{{ saved ? "设备详情" : "添加设备" }}</h2>
        <button
          type="button"
          class="icon-button"
          :disabled="busy"
          aria-label="关闭"
          @click="close"
        >
          <X :size="18" />
        </button>
      </div>
      <div class="dialog-body">
        <div v-if="error" class="notice" role="alert">{{ error }}</div>
        <fieldset :disabled="busy">
          <div class="form-grid">
            <label class="full"
              >设备名称<input
                v-model="f.name"
                autofocus
                required
                maxlength="255"
                placeholder="例如：我的笔记本电脑"
            /></label>
            <label
              >设备分类<select v-model="f.category">
                <option v-for="c in categories" :key="c">{{ c }}</option>
              </select></label
            >
            <label
              >使用状态<select v-model="f.status">
                <option v-for="s in statuses" :key="s">{{ s }}</option>
              </select></label
            >
            <label>品牌<input v-model="f.manufacturer" maxlength="255" /></label
            ><label
              >型号<input
                v-model="f.modelNumber"
                class="data-text"
                maxlength="255"
            /></label>
            <label class="full"
              >规格摘要<input
                v-model="f.description"
                maxlength="1000"
                placeholder="处理器、内存、颜色等"
            /></label>
            <label
              >序列号<input
                v-model="f.serialNumber"
                class="data-text"
                maxlength="255" /></label
            ><label
              >数量<input
                v-model.number="f.quantity"
                type="number"
                min="1"
                max="100000"
                step="1"
                required
            /></label>
          </div>
          <h3 class="form-subtitle">购入与保修</h3>
          <div class="form-grid">
            <label
              >购入单价<input
                v-model.number="f.purchasePrice"
                type="number"
                min="0"
                max="999999999"
                step="0.01"
                required /></label
            ><label
              >购入日期<input v-model="f.purchaseDate" type="date" /></label
            ><label
              >购买渠道<input v-model="f.purchaseFrom" maxlength="255" /></label
            ><label
              >保修到期<input
                v-model="f.warrantyExpires"
                type="date"
                :disabled="f.lifetimeWarranty" /></label
            ><label class="full"
              >保修说明<input v-model="f.warrantyDetails" maxlength="1000"
            /></label>
          </div>
          <div class="check-list" style="margin-top: 12px">
            <label
              ><input
                v-model="f.lifetimeWarranty"
                type="checkbox"
              />终身保修</label
            >
          </div>
          <div
            v-if="f.status === '已售出'"
            class="form-grid"
            style="margin-top: 16px"
          >
            <label
              >售出日期<input
                v-model="f.soldDate"
                type="date"
                required /></label
            ><label
              >售出单价<input
                v-model.number="f.soldPrice"
                type="number"
                min="0"
                step="0.01"
            /></label>
          </div>
          <h3 class="form-subtitle">装备分组</h3>
          <div class="check-list">
            <label v-for="g in groups" :key="g.id"
              ><input v-model="f.tagIds" type="checkbox" :value="g.id" />{{
                g.name
              }}</label
            ><span v-if="!groups.length" style="color: var(--muted)"
              >暂无分组</span
            >
          </div>
          <div class="upload-row">
            <h3 class="form-subtitle" style="margin: 0">
              <ImagePlus
                :size="17"
                style="display: inline; margin-right: 6px"
              />设备照片
            </h3>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              aria-label="上传设备照片"
              @change="choose"
            />
          </div>
          <div v-if="saved" class="photo-strip">
            <div v-for="p in photos" :key="p.id" class="photo-tile">
              <a :href="photo(saved, p.id)" target="_blank" rel="noopener"
                ><img :src="photo(saved, p.id)" :alt="p.title"
              /></a>
              <div>
                <button
                  type="button"
                  :class="{ 'is-primary': p.primary }"
                  @click="changePhoto(p)"
                >
                  <Star :size="12" style="display: inline" />{{
                    p.primary ? "封面" : "设为封面"
                  }}</button
                ><button
                  type="button"
                  :aria-label="`删除照片 ${p.title}`"
                  @click="changePhoto(p, true)"
                >
                  <Trash2 :size="13" />
                </button>
              </div>
            </div>
          </div>
          <div
            v-for="(file, index) in pending"
            :key="index"
            class="card-line"
            style="margin: 6px 0; font-size: 12px"
          >
            <span>{{ file.name }} · 待上传</span
            ><button
              type="button"
              aria-label="移除待上传照片"
              @click="pending.splice(index, 1)"
            >
              <X :size="14" />
            </button>
          </div>
          <div class="form-grid" style="margin-top: 18px">
            <label class="full"
              >备注<textarea v-model="f.notes" maxlength="10000" />
            </label>
          </div>
          <NuxtLink
            v-if="saved"
            :to="`/item/${saved.id}`"
            class="btn"
            style="margin-top: 16px; font-size: 12px"
            ><ExternalLink :size="14" />完整记录与维护日志</NuxtLink
          >
        </fieldset>
      </div>
      <div class="dialog-foot">
        <GlassSurface />
        <button
          v-if="saved"
          type="button"
          class="btn danger"
          :disabled="busy"
          @click="removeDevice"
        >
          <Trash2 :size="16" />删除</button
        ><button type="button" class="btn" :disabled="busy" @click="close">
          取消</button
        ><button type="submit" class="btn primary" :disabled="busy">
          <Save :size="16" />{{ busy ? "保存中…" : "保存设备" }}
        </button>
      </div>
    </form>
  </dialog>
</template>

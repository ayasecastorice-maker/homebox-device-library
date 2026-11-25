<script setup lang="ts">
import { Camera, RotateCcw, Save, Trash2, UserRound, X } from "lucide-vue-next";
import GlassSurface from "~/components/Device/GlassSurface.vue";

const { image, refreshAvatar, saveAvatar } = useAccountAvatar();
const picker = ref<HTMLInputElement>();
const dialog = ref<HTMLDialogElement>();
const canvas = ref<HTMLCanvasElement>();
const motion = useDeviceDialog(dialog);
const busy = ref(false);
const loading = ref(true);
const error = ref("");
const message = ref("");
const zoom = ref(1);
const horizontal = ref(50);
const vertical = ref(50);
let bitmap: ImageBitmap | undefined;
let disposed = false;

onMounted(async () => {
  try {
    await refreshAvatar();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => {
  disposed = true;
  bitmap?.close();
});

function draw() {
  const context = canvas.value?.getContext("2d");
  if (!bitmap || !context) return;
  const size = Math.min(bitmap.width, bitmap.height) / zoom.value;
  const x = ((bitmap.width - size) * horizontal.value) / 100;
  const y = ((bitmap.height - size) * vertical.value) / 100;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 256, 256);
  context.drawImage(bitmap, x, y, size, size, 0, 0, 256, 256);
}
watch([zoom, horizontal, vertical], draw);

function resetCrop() {
  zoom.value = 1;
  horizontal.value = 50;
  vertical.value = 50;
  draw();
}

async function selectPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  error.value = "";
  message.value = "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    error.value = "请选择 JPG、PNG 或 WebP 图片";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    error.value = "图片不能超过 10 MB";
    return;
  }
  busy.value = true;
  try {
    const decoded = await createImageBitmap(file);
    if (disposed) {
      decoded.close();
      return;
    }
    if (decoded.width * decoded.height > 40_000_000) {
      decoded.close();
      throw new Error("图片尺寸过大，请选择不超过 4000 万像素的图片");
    }
    bitmap?.close();
    bitmap = decoded;
    resetCrop();
    motion.open();
    await nextTick();
    draw();
  } catch (e) {
    error.value =
      e instanceof Error && e.message.startsWith("图片尺寸")
        ? e.message
        : "无法读取图片，请换一张 JPG、PNG 或 WebP 图片";
  } finally {
    busy.value = false;
  }
}

async function close() {
  if (busy.value) return;
  await motion.close(() => {
    bitmap?.close();
    bitmap = undefined;
    error.value = "";
  });
}

async function persist() {
  if (!canvas.value || !bitmap || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const encoded = canvas.value.toDataURL("image/jpeg", 0.85);
    await saveAvatar(encoded);
    message.value = "头像已保存";
    await motion.close(() => {
      bitmap?.close();
      bitmap = undefined;
    });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    await saveAvatar("");
    message.value = "已恢复默认头像";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section id="avatar" class="settings-row avatar-settings">
    <div class="avatar-identity">
      <div class="account-avatar avatar-large" aria-label="当前头像">
        <img v-if="image" :src="image" alt="账号头像" />
        <UserRound v-else :size="30" :stroke-width="1.5" />
      </div>
      <div>
        <h2>个人头像</h2>
        <p>JPG、PNG、WebP · 最大 10 MB</p>
      </div>
    </div>
    <div class="actions">
      <input
        ref="picker"
        class="avatar-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="选择头像图片"
        tabindex="-1"
        @change="selectPhoto"
      />
      <button
        type="button"
        class="btn"
        :disabled="busy || loading"
        @click="picker?.click()"
      >
        <Camera :size="16" />{{ image ? "更换头像" : "上传头像" }}
      </button>
      <button
        v-if="image"
        type="button"
        class="icon-button"
        :disabled="busy || loading"
        title="移除头像"
        aria-label="移除头像"
        @click="remove"
      >
        <Trash2 :size="18" />
      </button>
    </div>
  </section>
  <p v-if="message" class="avatar-feedback" role="status">{{ message }}</p>
  <p v-if="error && !dialog?.open" class="notice" role="alert">{{ error }}</p>
  <dialog
    ref="dialog"
    class="device-dialog avatar-dialog"
    aria-labelledby="avatar-editor-title"
    @cancel.prevent="close"
  >
    <form @submit.prevent="persist">
      <div class="dialog-head">
        <GlassSurface />
        <h2 id="avatar-editor-title">调整头像</h2>
        <button
          type="button"
          class="icon-button"
          aria-label="关闭头像编辑"
          :disabled="busy"
          @click="close"
        >
          <X :size="18" />
        </button>
      </div>
      <div class="dialog-body">
        <div v-if="error" class="notice" role="alert">{{ error }}</div>
        <canvas
          ref="canvas"
          width="256"
          height="256"
          class="avatar-preview"
          aria-label="头像裁剪预览"
          role="img"
        />
        <fieldset class="avatar-adjustments" :disabled="busy">
          <label
            >缩放<input
              v-model.number="zoom"
              type="range"
              min="1"
              max="3"
              step="0.01"
          /></label>
          <label
            >水平位置<input
              v-model.number="horizontal"
              type="range"
              min="0"
              max="100"
              step="1"
          /></label>
          <label
            >垂直位置<input
              v-model.number="vertical"
              type="range"
              min="0"
              max="100"
              step="1"
          /></label>
        </fieldset>
      </div>
      <div class="dialog-foot">
        <GlassSurface />
        <button
          type="button"
          class="icon-button"
          title="重置裁剪"
          aria-label="重置裁剪"
          :disabled="busy"
          @click="resetCrop"
        >
          <RotateCcw :size="18" />
        </button>
        <button type="button" class="btn" :disabled="busy" @click="close">
          取消
        </button>
        <button type="submit" class="btn primary" :disabled="busy">
          <Save :size="16" />{{ busy ? "保存中" : "保存头像" }}
        </button>
      </div>
    </form>
  </dialog>
</template>

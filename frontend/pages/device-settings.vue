<script setup lang="ts">
import { Download, ExternalLink, Save } from "lucide-vue-next";
import AvatarSettings from "~/components/Device/AvatarSettings.vue";
import { downloadCSV } from "~/lib/devices";
definePageMeta({
  layout: "device",
  middleware: ["auth"],
  pageTransition: { name: "device-page", mode: "out-in" },
});
useHead({ title: "设置 · Homebox" });
const { api, items, refresh, currency } = useDeviceLibrary();
const chosen = ref("CNY"),
  name = ref(""),
  message = ref(""),
  busy = ref(false);
onMounted(async () => {
  await refresh();
  chosen.value = currency.value;
  const r = await api.group.get();
  if (!r.error) name.value = r.data.name;
});
async function save() {
  busy.value = true;
  message.value = "";
  try {
    const r = await api.group.update({
      name: name.value,
      currency: chosen.value,
    });
    if (r.error) throw new Error();
    currency.value = chosen.value;
    message.value = "币种已保存（仅更改标记，不进行汇率换算）";
  } catch {
    message.value = "保存失败，请重试";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="device-page">
    <div class="page-heading">
      <div>
        <h1>设置</h1>
        <p>个人设备库</p>
      </div>
    </div>
    <AvatarSettings />
    <section class="settings-row">
      <div>
        <h2>资产币种</h2>
        <p>全部设备使用同一币种，不自动换算历史金额</p>
      </div>
      <div class="actions">
        <select v-model="chosen" aria-label="资产币种">
          <option value="CNY">人民币 CNY</option>
          <option value="USD">美元 USD</option>
          <option value="EUR">欧元 EUR</option>
          <option value="HKD">港币 HKD</option>
          <option value="JPY">日元 JPY</option></select
        ><button class="btn primary" :disabled="busy || !name" @click="save">
          <Save :size="16" />保存
        </button>
      </div>
    </section>
    <p
      v-if="message"
      role="status"
      style="margin-top: 12px; color: var(--muted)"
    >
      {{ message }}
    </p>
    <section class="settings-row">
      <div>
        <h2>导出设备清单</h2>
        <p>CSV 文件，包含购入金额、设备分类与分组</p>
      </div>
      <button class="btn" @click="downloadCSV(items, 'homebox-devices.csv')">
        <Download :size="16" />导出
      </button>
    </section>
    <section class="settings-row">
      <div>
        <h2>账号、备份与完整设置</h2>
        <p>Homebox 原版管理界面</p>
      </div>
      <NuxtLink to="/profile" class="btn"
        ><ExternalLink :size="16" />打开</NuxtLink
      >
    </section>
  </div>
</template>

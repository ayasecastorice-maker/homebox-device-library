<script setup lang="ts">
import {
  Box,
  LayoutGrid,
  ChartNoAxesColumnIncreasing,
  Layers,
  Settings,
  UserRound,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-vue-next";
import "~/assets/css/devices.css";
import "~/assets/css/device-fonts.css";
import "~/assets/css/liquid-device.css";
import "~/assets/css/device-order.css";
import "~/assets/css/device-motion.css";
import GlassSurface from "~/components/Device/GlassSurface.vue";
const auth = useAuthContext();
const { image: avatar, refreshAvatar, clearAvatarCache } = useAccountAvatar();
onMounted(() => {
  void refreshAvatar().catch(() => {});
});
const open = ref(false);
const route = useRoute();
watch(
  () => route.path,
  () => {
    open.value = false;
  },
);
const nav = [
  { to: "/devices", label: "设备照片库", icon: LayoutGrid },
  {
    to: "/device-statistics",
    label: "资产统计",
    icon: ChartNoAxesColumnIncreasing,
  },
  { to: "/equipment-groups", label: "装备分组", icon: Layers },
];
const currentPage = computed(
  () =>
    [...nav, { to: "/device-settings", label: "设置" }].find(
      (link) => link.to === route.path,
    )?.label,
);
const activeNav = computed(() =>
  nav.findIndex((link) => link.to === route.path),
);
const motionDirection = ref(1);
const pageOrder = [...nav.map((link) => link.to), "/device-settings"];
const removeMotionHook = useRouter().afterEach((to, from, failure) => {
  if (failure) return;
  const previous = pageOrder.indexOf(from.path);
  const next = pageOrder.indexOf(to.path);
  if (previous >= 0 && next >= 0 && previous !== next) {
    motionDirection.value = next > previous ? 1 : -1;
  }
});
onBeforeUnmount(removeMotionHook);
useHead({ meta: [{ name: "theme-color", content: "#FAF9F5" }] });
async function logout() {
  await auth.logout(useUserApi());
  clearAvatarCache();
  await navigateTo("/");
}
</script>
<template>
  <div
    class="device-app"
    :style="{ '--page-direction': motionDirection }"
    @keydown.esc="open = false"
  >
    <header class="mobile-header">
      <GlassSurface />
      <button class="icon-button" aria-label="打开导航" @click="open = true">
        <Menu :size="22" /></button
      ><strong>Homebox</strong>
    </header>
    <Transition name="device-scrim"
      ><button
        v-if="open"
        class="nav-scrim"
        aria-label="关闭导航"
        @click="open = false"
    /></Transition>
    <aside class="device-sidebar" :class="{ 'is-open': open }">
      <GlassSurface class="sidebar-glass" />
      <NuxtLink to="/devices" class="device-brand"
        ><span class="brand-mark"><Box :size="26" :stroke-width="1.4" /></span
        ><span
          ><strong>Homebox</strong><small>个人设备库</small></span
        ></NuxtLink
      >
      <button
        v-if="open"
        class="icon-button nav-close"
        aria-label="关闭导航"
        @click="open = false"
      >
        <X :size="20" />
      </button>
      <nav aria-label="主导航">
        <GlassSurface
          class="nav-lens nav-selection"
          material="liquid"
          :radius="24"
          :scale="12"
          :frost="0.4"
          :blur="1.4"
          :style="{
            transform: `translateY(${Math.max(0, activeNav) * 55}px)`,
            opacity: activeNav < 0 ? 0 : 1,
          }"
        />
        <NuxtLink
          v-for="link in nav"
          :key="link.to"
          :to="link.to"
          class="device-nav"
          ><component :is="link.icon" :size="21" /><span>{{
            link.label
          }}</span></NuxtLink
        >
      </nav>
      <div class="sidebar-bottom">
        <NuxtLink to="/device-settings" class="device-nav"
          ><GlassSurface
            v-if="route.path === '/device-settings'"
            class="nav-selection"
            material="liquid"
            :radius="24"
            :scale="12"
            :frost="0.4"
            :blur="1.4"
          />
          <Settings :size="21" /><span>设置</span></NuxtLink
        >
        <div class="account-row">
          <NuxtLink
            to="/device-settings#avatar"
            class="account-avatar"
            title="编辑头像"
            aria-label="编辑头像"
          >
            <img v-if="avatar" :src="avatar" alt="账号头像" />
            <UserRound v-else :size="21" /> </NuxtLink
          ><span :title="auth.user?.email">{{
            auth.user?.name || "个人空间"
          }}</span
          ><button
            class="icon-button"
            title="退出登录"
            aria-label="退出登录"
            @click="logout"
          >
            <LogOut :size="17" />
          </button>
        </div>
      </div>
    </aside>
    <main class="device-main">
      <div class="breadcrumb">
        <span>我的设备</span><ChevronRight :size="13" /><span
          class="breadcrumb-current"
          >{{ currentPage }}</span
        >
      </div>
      <slot />
    </main>
  </div>
</template>

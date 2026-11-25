<script setup lang="ts">
import {
  useDocumentVisibility,
  useElementVisibility,
  usePreferredReducedMotion,
} from "@vueuse/core";

withDefaults(
  defineProps<{
    material?: "frosted" | "liquid";
    radius?: number;
    scale?: number;
    frost?: number;
    blur?: number;
    live?: boolean;
  }>(),
  {
    material: "frosted",
    radius: 12,
    scale: 95,
    frost: 0.42,
    blur: 0.6,
    live: false,
  },
);

const surface = ref<HTMLElement>();
const visible = useElementVisibility(surface);
const visibility = useDocumentVisibility();
const reducedMotion = usePreferredReducedMotion();
</script>

<template>
  <liquid-glass
    v-if="material === 'liquid'"
    ref="surface"
    class="glass-surface"
    aria-hidden="true"
    :radius="radius"
    :scale="scale"
    :frost="frost"
    :blur.attr="blur"
    displace="1.8"
    saturation="118"
    lightness="55"
    alpha="0.88"
    lens="rim"
    lens-strength="1.25"
    border-color="rgba(255,255,255,0.94)"
    :liquid="
      live && visible && visibility === 'visible' && reducedMotion !== 'reduce'
        ? 'flow'
        : undefined
    "
    liquid-speed="0.35"
    liquid-scale="2.4"
  />
  <div
    v-else
    ref="surface"
    class="glass-surface glass-frosted"
    aria-hidden="true"
  />
</template>

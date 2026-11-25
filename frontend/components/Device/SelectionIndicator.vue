<script setup lang="ts">
const props = defineProps<{ active: string }>();
const rail = ref<HTMLSpanElement>();
const geometry = ref({ x: 0, width: 0 });
const ready = ref(false);
let observer: ResizeObserver | undefined;
let frame = 0;
let disposed = false;

function measure() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const parent = rail.value?.parentElement;
    const selected = parent?.querySelector<HTMLElement>(
      'button[aria-pressed="true"]',
    );
    if (!parent || !selected) return;
    // Layout coordinates stay stable while an ancestor's entrance is animating.
    geometry.value = { x: selected.offsetLeft, width: selected.offsetWidth };
    ready.value = true;
  });
}

watch(() => props.active, measure, { flush: "post" });
onMounted(() => {
  const parent = rail.value?.parentElement;
  if (!parent) return;
  observer = new ResizeObserver(measure);
  observer.observe(parent);
  parent
    .querySelectorAll("button")
    .forEach((button) => observer!.observe(button));
  document.fonts.ready.then(() => {
    if (!disposed) measure();
  });
  measure();
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  cancelAnimationFrame(frame);
});
</script>

<template>
  <span
    ref="rail"
    class="selection-indicator"
    aria-hidden="true"
    :data-ready="ready || undefined"
    :style="{
      transform: `translateX(${geometry.x}px)`,
      width: `${geometry.width}px`,
    }"
  />
</template>

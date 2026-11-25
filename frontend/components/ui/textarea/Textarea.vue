<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
import { useVModel } from "@vueuse/core";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  defaultValue?: string | number;
  modelValue?: string | number;
  autosize?: boolean;
}>();

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void;
}>();

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
});
const { textarea } = useTextareaAutosize({
  input: computed(() => String(modelValue.value ?? "")),
});

const classes = computed(() =>
  cn(
    "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/10 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
    props.class,
  ),
);
</script>

<template>
  <textarea v-if="!props.autosize" v-model="modelValue" :class="classes" />
  <textarea
    v-else
    ref="textarea"
    v-model="modelValue"
    :class="classes"
    class="resize-none"
  />
</template>

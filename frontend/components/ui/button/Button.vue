<script setup lang="ts">
  import { type HTMLAttributes, useAttrs } from "vue";
  import { Primitive, type PrimitiveProps } from "reka-ui";
  import { type ButtonVariants, buttonVariants } from ".";
  import { cn } from "@/lib/utils";

  interface Props extends PrimitiveProps {
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    class?: HTMLAttributes["class"];
  }

  const props = withDefaults(defineProps<Props>(), {
    as: "button",
  });
  const attrs = useAttrs();
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn(
      buttonVariants({ variant, size }),
      attrs.role === 'combobox' && 'focus-visible:border-ring focus-visible:ring-ring/10 focus-visible:ring-offset-0',
      props.class,
    )"
    :data-button="true"
  >
    <slot />
  </Primitive>
</template>

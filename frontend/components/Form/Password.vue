<template>
  <div class="password-field relative" :class="wrapperClass()">
    <FormTextField
      v-bind="fieldAttrs()"
      v-model="value"
      :placeholder="localizedPlaceholder"
      :label="localizedLabel"
      :type="inputType"
    />
    <TooltipProvider :delay-duration="0">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="password-toggle"
            :aria-label="$t('components.form.password.toggle_show')"
            :aria-pressed="!hide"
            @click="toggle()"
          >
            <Eye v-if="hide" :size="20" aria-hidden="true" />
            <EyeOff v-else :size="20" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{{
          $t("components.form.password.toggle_show")
        }}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Eye, EyeOff } from "lucide-vue-next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import FormTextField from "@/components/Form/TextField.vue";

defineOptions({
  inheritAttrs: false,
});

const attrs = useAttrs();

const { t } = useI18n();
type Props = {
  modelValue: string;
  placeholder?: string;
  label: string;
};

const props = defineProps<Props>();

const [hide, toggle] = useToggle(true);

const localizedPlaceholder = computed(
  () => props.placeholder ?? t("global.password"),
);
const localizedLabel = computed(() => props.label ?? t("global.password"));

const inputType = computed(() => {
  return hide.value ? "password" : "text";
});

function wrapperClass() {
  return attrs.class;
}

function fieldAttrs() {
  const { class: _class, ...rest } = attrs;
  return rest;
}

const value = useVModel(props, "modelValue");
</script>

<style scoped>
.password-field :deep(input) {
  padding-right: 3rem;
}
/* Edge/WebView2 also provides a reveal button; keep only our accessible toggle. */
.password-field :deep(input::-ms-reveal),
.password-field :deep(input::-ms-clear) {
  display: none;
}
.password-toggle {
  position: absolute;
  right: 0.35rem;
  bottom: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}
.password-toggle:focus-visible {
  outline: 2px solid #65889b;
  outline-offset: -3px;
}
</style>

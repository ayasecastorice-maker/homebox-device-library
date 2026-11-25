<script setup lang="ts">
import {
  GripVertical,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  ListOrdered,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
const props = defineProps<{
  name: string;
  index: number;
  total: number;
  disabled?: boolean;
}>();
const emit = defineEmits<{ move: [index: number]; position: [] }>();
function keyMove(event: KeyboardEvent) {
  const targets: Record<string, number> = {
    ArrowUp: props.index - 1,
    ArrowLeft: props.index - 1,
    ArrowDown: props.index + 1,
    ArrowRight: props.index + 1,
    Home: 0,
    End: props.total - 1,
  };
  const target = targets[event.key];
  if (target === undefined) return;
  event.preventDefault();
  event.stopPropagation();
  if (
    !props.disabled &&
    target >= 0 &&
    target < props.total &&
    target !== props.index
  )
    emit("move", target);
}
</script>
<template>
  <div class="device-order-controls">
    <button
      type="button"
      class="icon-button device-order-grip"
      :disabled="disabled"
      :aria-label="`拖动排序 ${name}`"
      title="拖动排序"
      aria-keyshortcuts="ArrowUp ArrowDown Home End"
      @click.stop.prevent
      @keydown="keyMove"
    >
      <GripVertical :size="17" />
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger as-child
        ><button
          type="button"
          class="icon-button"
          :disabled="disabled"
          :aria-label="`调整顺序 ${name}`"
          title="调整顺序"
        >
          <MoreHorizontal :size="17" /></button
      ></DropdownMenuTrigger>
      <DropdownMenuContent class="device-order-popup" align="end">
        <DropdownMenuItem :disabled="index === 0" @select="emit('move', 0)"
          ><ArrowUpToLine :size="16" />移到首位</DropdownMenuItem
        >
        <DropdownMenuItem
          :disabled="index === 0"
          @select="emit('move', index - 1)"
          ><ArrowUp :size="16" />前移一位</DropdownMenuItem
        >
        <DropdownMenuItem
          :disabled="index === total - 1"
          @select="emit('move', index + 1)"
          ><ArrowDown :size="16" />后移一位</DropdownMenuItem
        >
        <DropdownMenuItem
          :disabled="index === total - 1"
          @select="emit('move', total - 1)"
          ><ArrowDownToLine :size="16" />移到末位</DropdownMenuItem
        >
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="emit('position')"
          ><ListOrdered :size="16" />移动到指定位置</DropdownMenuItem
        >
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

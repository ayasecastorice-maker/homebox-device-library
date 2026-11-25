import { onBeforeUnmount, ref, type Ref } from "vue";

// Keep the native dialog's focus trap and focus restoration until its exit finishes.
export function useDeviceDialog(dialog: Ref<HTMLDialogElement | undefined>) {
  const closing = ref(false);
  let animation: Animation | undefined;
  let disposed = false;

  function open() {
    if (closing.value) return;
    const trigger = document.activeElement?.getBoundingClientRect();
    const element = dialog.value;
    element?.showModal();
    if (element && trigger && trigger.width && trigger.height) {
      const box = element.getBoundingClientRect();
      const x = Math.max(
        10,
        Math.min(
          90,
          ((trigger.x + trigger.width / 2 - box.x) / box.width) * 100,
        ),
      );
      const y = Math.max(
        10,
        Math.min(
          90,
          ((trigger.y + trigger.height / 2 - box.y) / box.height) * 100,
        ),
      );
      element.style.setProperty("--dialog-origin", `${x}% ${y}%`);
    }
  }

  async function close(afterClose?: () => void) {
    const element = dialog.value;
    if (!element?.open || closing.value) return;
    closing.value = true;
    element.inert = true;
    // Start from the visible frame, including when Escape interrupts entry.
    const current = getComputedStyle(element);
    const firstFrame = {
      opacity: current.opacity,
      transform: current.transform,
    };
    element.classList.add("is-closing");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animation = element.animate(
        [firstFrame, { opacity: 0, transform: "translateY(16px) scale(0.96)" }],
        {
          duration: 220,
          easing: "cubic-bezier(0.4, 0, 0.8, 0.2)",
          fill: "forwards",
        },
      );
      await animation.finished.catch(() => {});
    }
    if (disposed) return;
    element.close();
    animation?.cancel();
    element.inert = false;
    element.classList.remove("is-closing");
    closing.value = false;
    afterClose?.();
  }

  onBeforeUnmount(() => {
    disposed = true;
    animation?.cancel();
    dialog.value?.close();
  });
  return { open, close, closing };
}

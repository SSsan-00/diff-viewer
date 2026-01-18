export type ToastVariant = "info" | "error";

type ToastManager = {
  show: (message: string, variant?: ToastVariant) => void;
};

const DEFAULT_DURATION_MS = 2600;
const MAX_TOASTS = 3;

export function createToastManager(root: HTMLElement): ToastManager {
  const enqueue = (message: string, variant: ToastVariant) => {
    const toast = document.createElement("div");
    toast.className = "toast";
    if (variant === "error") {
      toast.classList.add("toast--error");
    }
    toast.setAttribute("role", "status");
    toast.textContent = message;

    root.appendChild(toast);

    while (root.children.length > MAX_TOASTS) {
      root.removeChild(root.children[0]);
    }

    const duration = prefersReducedMotion() ? 0 : DEFAULT_DURATION_MS;
    if (duration === 0) {
      return;
    }

    window.setTimeout(() => {
      toast.remove();
    }, duration);
  };

  return {
    show(message: string, variant: ToastVariant = "info") {
      if (!message) {
        return;
      }
      enqueue(message, variant);
    },
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

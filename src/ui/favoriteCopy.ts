import type { ToastVariant } from "./toast";

type ToastLike = {
  show: (message: string, variant?: ToastVariant) => void;
};

export async function copyFavoritePath(options: {
  path: string;
  doc: Document;
  copy: (value: string, doc: Document) => Promise<boolean>;
  toast: ToastLike;
  onSuccess?: () => void;
}): Promise<boolean> {
  const { path, doc, copy, toast, onSuccess } = options;
  const ok = await copy(path, doc);
  if (ok) {
    toast.show("パスをコピーしました");
    onSuccess?.();
    return true;
  }
  toast.show("コピーに失敗しました", "error");
  return false;
}

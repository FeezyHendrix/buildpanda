export type ToastVariant = "error" | "warning" | "info" | "success";

export interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
}

type Listener = (toasts: ToastMessage[]) => void;

let nextId = 0;
let toasts: ToastMessage[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(message: string, variant: ToastVariant = "error") {
  const id = ++nextId;
  toasts = [...toasts, { id, message, variant }];
  notify();
  setTimeout(() => dismiss(id), 5000);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => listeners.delete(listener);
}

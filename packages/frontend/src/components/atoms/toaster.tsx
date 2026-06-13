import { useEffect, useState } from "react";
import { dismiss, subscribeToasts, type ToastMessage } from "@/lib/toast";

const VARIANT_STYLES: Record<ToastMessage["variant"], string> = {
  error: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-blue-600 text-white",
  success: "bg-green-600 text-white",
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm max-w-sm ${VARIANT_STYLES[t.variant]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-70 hover:opacity-100 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

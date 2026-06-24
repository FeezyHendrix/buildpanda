// Web desktop notifications. Permission is requested once when realtime
// connects; showDesktopNotification is a no-op when unsupported or not granted,
// so callers never have to guard. Built for web today; a future mobile build
// can swap the implementation behind the same two functions.

export function requestNotificationPermission(): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission().catch(() => undefined);
  }
}

export function showDesktopNotification(title: string, body?: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    // Tab is focused — the in-app bell already surfaces it; skip the OS popup.
    return;
  }
  try {
    new Notification(title, { body: body || undefined, icon: "/favicon.ico" });
  } catch {
    void 0;
  }
}

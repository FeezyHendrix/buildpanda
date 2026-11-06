import { useSyncExternalStore } from "react";

/**
 * Which attachments this browser has already downloaded, so their download
 * button can go away the way it does in WhatsApp. It is a per-device
 * convenience, not a record: it lives in localStorage and a cleared browser
 * simply shows the button again.
 */
const STORAGE_KEY = "chat:downloaded-files:v1";

const listeners = new Set<() => void>();
let downloaded: Set<string> | null = null;

function load(): Set<string> {
  if (downloaded) return downloaded;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    downloaded = new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    downloaded = new Set();
  }
  return downloaded;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markFileDownloaded(fileId: string): void {
  const next = new Set(load());
  next.add(fileId);
  downloaded = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Private mode or a full quota: the button just stays until the next reload.
  }
  listeners.forEach((listener) => listener());
}

export function useIsFileDownloaded(fileId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => load().has(fileId),
    () => false,
  );
}

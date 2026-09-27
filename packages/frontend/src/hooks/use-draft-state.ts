import { useCallback, useRef, useState, type SetStateAction } from "react";
import { useSession } from "@/stores/auth";

function readDraft<T>(key: string, initial: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? initial : JSON.parse(raw) as T;
  } catch {
    return initial;
  }
}

/** Tab-scoped, user-scoped drafts survive refresh and session expiry. Never store credentials. */
export function useDraftState<T>(name: string, initial: T) {
  const { data: session } = useSession();
  const key = `draft:v1:${session?.user.id ?? "anonymous"}:${name}`;
  const [state, setState] = useState(() => ({ key, value: readDraft(key, initial) }));
  const current = useRef(state);
  const value = state.key === key ? state.value : readDraft(key, initial);
  const setValue = useCallback((next: SetStateAction<T>) => {
    const previous = current.current;
    const old = previous.key === key ? previous.value : readDraft(key, initial);
    const value = typeof next === "function" ? (next as (value: T) => T)(old) : next;
    if (previous.key === key && Object.is(previous.value, value)) return;
    current.current = { key, value };
    setState(current.current);
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep editing in memory when browser storage is unavailable.
    }
  }, [key, initial]);
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // There is no persisted draft to clear when storage is unavailable.
    }
  }, [key]);
  return [value, setValue, clear] as const;
}

export function clearDraftGroup(userId: string, group: string) {
  try {
    const prefix = `draft:v1:${userId}:${group}`;
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage unavailable. */ }
}

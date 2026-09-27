import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Preserve this session's writes even if device storage is temporarily unavailable.
const memory = new Map<string, string | null>();

/** Credentials and field scope use the keychain on native and localStorage in web previews. */
export const storage = {
  getItem(key: string): string | null {
    if (memory.has(key)) return memory.get(key) ?? null;
    try {
      return (Platform.OS === "web"
        ? globalThis.localStorage?.getItem(key)
        : SecureStore.getItem(key)) || null;
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    memory.set(key, value);
    try {
      if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
      else SecureStore.setItem(key, value);
    } catch {
      // The in-memory value remains available for this session.
    }
  },

  removeItem(key: string): void {
    memory.set(key, null);
    try {
      if (Platform.OS === "web") globalThis.localStorage?.removeItem(key);
      // A synchronous empty value cannot race a subsequent sign-in, unlike
      // deleteItemAsync completing after the new identity has been stored.
      else SecureStore.setItem(key, "");
    } catch {
      // Keep the in-memory tombstone so a stale identity cannot reappear.
    }
  },
};

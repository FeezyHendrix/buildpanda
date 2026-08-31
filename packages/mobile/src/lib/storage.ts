import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Key/value storage for the session and field scope.
 *
 * expo-secure-store has no web implementation, and this app also builds through
 * react-native-web, so the web target falls back to localStorage. Web is a
 * development/preview surface only — the keychain is what protects a real
 * device, and localStorage is not equivalent.
 */
export const storage = {
  getItem(key: string): string | null {
    if (Platform.OS === "web") {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    try {
      return SecureStore.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (Platform.OS === "web") {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // Private mode / quota — value stays in memory for this session.
      }
      return;
    }
    try {
      SecureStore.setItem(key, value);
    } catch {
      // Keychain unavailable.
    }
  },

  removeItem(key: string): void {
    if (Platform.OS === "web") {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // Nothing to clean up.
      }
      return;
    }
    void SecureStore.deleteItemAsync(key).catch(() => undefined);
  },
};

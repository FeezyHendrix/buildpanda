import SQLiteStorage from "expo-sqlite/kv-store";
import { Platform } from "react-native";

// Query responses can exceed keychain value limits, and their keys contain JSON.
// Keep cached responses in SQLite; credentials stay in SecureStore via storage.ts.
export const queryStorage = {
  getItem(key: string): string | null {
    return Platform.OS === "web"
      ? globalThis.localStorage?.getItem(key) ?? null
      : SQLiteStorage.getItemSync(key);
  },
  setItem(key: string, value: string): void {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
    else SQLiteStorage.setItemSync(key, value);
  },
};

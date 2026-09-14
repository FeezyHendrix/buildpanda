import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { View } from "react-native";
import migrations from "../../drizzle/migrations";
import { Spinner, Text } from "@/components/atoms";
import { useFieldSession } from "@/lib/field-session";
import { getDb, type Db } from "./client";

interface LocalDb {
  db: Db | null;
  ready: boolean;
  error: Error | null;
}

const LocalDbContext = createContext<LocalDb>({ db: null, ready: false, error: null });

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * Why the store could not be opened, in words a person on site can act on.
 * The browser case is not a fault in the app: expo-sqlite on web is a
 * WebAssembly build that needs SharedArrayBuffer, which browsers only expose to
 * a cross-origin-isolated page.
 */
function explain(error: Error): string {
  if (error.message.includes("SharedArrayBuffer")) {
    return "The offline store cannot run in this browser. Open Field Tools on your phone or tablet, where it works offline as designed.";
  }
  return "The offline store on this device could not be opened. Signing out and back in creates a fresh one; if it keeps happening, send us this message.";
}

/**
 * Opens the signed-in user's database and runs migrations before any screen
 * reads from it. Without an owner there is nothing to open — the sign-in screen
 * renders fine with a null db.
 *
 * Opening is wrapped because it throws: a locked or corrupt file on a shared
 * site tablet, or a browser with no SharedArrayBuffer, used to take the whole
 * app down with a red screen mid-render. The context has always carried an
 * `error` field; now it can actually reach it.
 */
export function LocalDbProvider({ children }: { children: ReactNode }) {
  const { storageOwnerId } = useFieldSession();

  const opened = useMemo(() => {
    if (!storageOwnerId) return { db: null, openError: null };
    try {
      return { db: getDb(storageOwnerId), openError: null };
    } catch (cause) {
      return { db: null, openError: toError(cause) };
    }
  }, [storageOwnerId]);

  const { success, error: migrationError } = useMigrations(opened.db as never, migrations);
  const error = opened.openError ?? migrationError ?? null;

  const value = useMemo<LocalDb>(
    () => ({ db: opened.db, ready: Boolean(opened.db) && success, error }),
    [opened.db, success, error],
  );

  // Every tool screen reads from this store, so there is nothing useful to show
  // behind a failure — say what happened instead of rendering broken screens.
  if (storageOwnerId && error) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
        <Text className="text-center text-base font-semibold text-black-500">
          Field Tools cannot open its offline store
        </Text>
        <Text className="text-center text-sm text-black-300">{explain(error)}</Text>
      </View>
    );
  }

  if (storageOwnerId && !success) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Spinner />
      </View>
    );
  }

  return <LocalDbContext.Provider value={value}>{children}</LocalDbContext.Provider>;
}

export function useLocalDb(): LocalDb {
  return useContext(LocalDbContext);
}

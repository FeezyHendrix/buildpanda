import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
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

/**
 * Opens the signed-in user's database and runs migrations before any screen
 * reads from it. Without an owner there is nothing to open — the sign-in screen
 * renders fine with a null db.
 */
export function LocalDbProvider({ children }: { children: ReactNode }) {
  const { storageOwnerId } = useFieldSession();
  const db = useMemo(() => (storageOwnerId ? getDb(storageOwnerId) : null), [storageOwnerId]);
  const { success, error } = useMigrations(db as never, migrations);

  const value = useMemo<LocalDb>(
    () => ({ db, ready: Boolean(db) && success, error: error ?? null }),
    [db, success, error],
  );

  return <LocalDbContext.Provider value={value}>{children}</LocalDbContext.Provider>;
}

export function useLocalDb(): LocalDb {
  return useContext(LocalDbContext);
}

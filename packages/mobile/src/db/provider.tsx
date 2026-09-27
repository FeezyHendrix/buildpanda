import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { View } from "react-native";
import migrations from "../../drizzle/migrations";
import { Button, Spinner, Text } from "@/components/atoms";
import { useFieldSession } from "@/lib/field-session";
import { openDb, type Db } from "./client";

interface LocalDb {
  db: Db | null;
  ready: boolean;
  error: Error | null;
}

const emptyDb: LocalDb = { db: null, ready: false, error: null };
const LocalDbContext = createContext<LocalDb>(emptyDb);

function DatabaseError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-canvas px-8">
      <Text weight="semibold" className="text-center text-base">
        Field Tools cannot open its offline store
      </Text>
      <Text tone="secondary" className="text-center text-sm">
        {error.message.includes("SharedArrayBuffer")
          ? "Open Field Tools in the mobile app. This browser cannot open the offline store."
          : "Try opening the store again. Your saved records have not been deleted. If this keeps happening, share the message below with support."}
      </Text>
      <Text selectable tone="muted" className="text-center text-xs">{error.message}</Text>
      <Button onPress={onRetry}>Try again</Button>
    </View>
  );
}

function MigratedDatabase({ db, children, onRetry }: { db: Db; children: ReactNode; onRetry: () => void }) {
  const { success, error } = useMigrations(db, migrations);
  const value = useMemo<LocalDb>(() => ({ db, ready: success, error: error ?? null }), [db, success, error]);

  if (error) return <DatabaseError error={error} onRetry={onRetry} />;
  if (!success) {
    return <View className="flex-1 items-center justify-center bg-canvas"><Spinner /></View>;
  }
  return <LocalDbContext.Provider value={value}>{children}</LocalDbContext.Provider>;
}

function UserDatabase({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [opened, setOpened] = useState<{ db: Db | null; error: Error | null }>({ db: null, error: null });
  useEffect(() => {
    let cancelled = false;
    setOpened({ db: null, error: null });
    openDb(ownerId).then((db) => {
      if (!cancelled) setOpened({ db, error: null });
    }).catch((cause: unknown) => {
      if (!cancelled) setOpened({ db: null, error: cause instanceof Error ? cause : new Error(String(cause)) });
    });
    return () => { cancelled = true; };
  }, [ownerId, attempt]);
  const retry = () => setAttempt((value) => value + 1);
  if (opened.error) return <DatabaseError error={opened.error} onRetry={retry} />;
  if (!opened.db) return <View className="flex-1 items-center justify-center bg-canvas"><Spinner /></View>;
  return <MigratedDatabase key={attempt} db={opened.db} onRetry={retry}>{children}</MigratedDatabase>;
}

/** Migration hooks run once per mount, so mount them only for a real owner/database. */
export function LocalDbProvider({ children }: { children: ReactNode }) {
  const { storageOwnerId } = useFieldSession();
  if (!storageOwnerId) return <LocalDbContext.Provider value={emptyDb}>{children}</LocalDbContext.Provider>;
  return <UserDatabase key={storageOwnerId} ownerId={storageOwnerId}>{children}</UserDatabase>;
}

export function useLocalDb(): LocalDb {
  return useContext(LocalDbContext);
}

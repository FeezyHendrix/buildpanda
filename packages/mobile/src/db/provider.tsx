import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { Platform, View } from "react-native";
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
const migrationRuns = new WeakMap<Db, Promise<void>>();

// A scope remount can overlap the previous mount while migration files load.
// Share one run per database so neither transaction rolls the other one back.
function migrateDatabase(db: Db): Promise<void> {
  const running = migrationRuns.get(db);
  if (running) return running;
  const promise = migrate(db, migrations).catch((error: unknown) => {
    migrationRuns.delete(db);
    throw error;
  });
  migrationRuns.set(db, promise);
  return promise;
}

/**
 * Why the store is dead, in the browser's own terms.
 *
 * The web store needs cross-origin isolation: without it wa-sqlite cannot
 * create its OPFS VFS, and expo-sqlite fails with "Invalid VFS state" — a
 * message that never contains the word SharedArrayBuffer, so matching on that
 * string reported a platform limit as a retryable glitch and offered a
 * "Try again" that could never succeed.
 */
function storeDiagnostic(): { isolationBroken: boolean; detail: string } | null {
  if (Platform.OS !== "web") return null;
  const isolated = typeof globalThis.crossOriginIsolated === "boolean" ? globalThis.crossOriginIsolated : false;
  const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  const opfs = typeof navigator !== "undefined" && Boolean(navigator.storage?.getDirectory);
  return {
    isolationBroken: !isolated || !sharedArrayBuffer || !opfs,
    detail: `crossOriginIsolated=${isolated} · SharedArrayBuffer=${sharedArrayBuffer} · OPFS=${opfs}`,
  };
}

function DatabaseError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const diagnostic = storeDiagnostic();
  const isolationFailure = diagnostic?.isolationBroken === true;
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-canvas px-8">
      <Text weight="semibold" className="text-center text-base">
        Field Tools cannot open its offline store
      </Text>
      <Text tone="secondary" className="text-center text-sm">
        {isolationFailure
          ? "This browser could not start the offline store. Reload once; if it keeps happening, open Field Tools in the mobile app and send support the line below."
          : "Try opening the store again. Your saved records have not been deleted. If this keeps happening, share the message below with support."}
      </Text>
      <Text selectable tone="muted" className="text-center text-xs">{error.message}</Text>
      {diagnostic ? (
        <Text selectable tone="muted" className="text-center text-xs">{diagnostic.detail}</Text>
      ) : null}
      <Button onPress={onRetry}>Try again</Button>
    </View>
  );
}

function MigratedDatabase({ db, children, onRetry }: { db: Db; children: ReactNode; onRetry: () => void }) {
  const [{ success, error }, setResult] = useState<{ success: boolean; error: Error | null }>({ success: false, error: null });
  useEffect(() => {
    let active = true;
    void migrateDatabase(db).then(() => {
      if (active) setResult({ success: true, error: null });
    }).catch((cause: unknown) => {
      if (active) setResult({ success: false, error: cause instanceof Error ? cause : new Error(String(cause)) });
    });
    return () => { active = false; };
  }, [db]);
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

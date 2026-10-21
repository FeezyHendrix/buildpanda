import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { Platform, View } from "react-native";
import migrations from "../../drizzle/migrations";
import { Button, Spinner, Text } from "@/components/atoms";
import { useFieldSession } from "@/lib/field-session";
import { openDb, resetDb, type Db } from "./client";

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

/**
 * Whether the OPFS root can be acquired, not merely named.
 *
 * WebKit exposes `navigator.storage.getDirectory` and then throws when a
 * context keeps no persistent storage, which is what private browsing does. So
 * presence reported the one browser where the store is impossible as healthy,
 * and the reported "Invalid VFS state" and "Failed to run the query begin"
 * both look like this. Only an attempted acquisition tells the two apart, and
 * it cannot be synchronous.
 */
async function probeOpfs(): Promise<string> {
  if (Platform.OS !== "web") return "n/a";
  if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) return "absent";
  try {
    await navigator.storage.getDirectory();
    return "usable";
  } catch (cause) {
    return `unusable(${cause instanceof Error ? cause.name : "unknown"})`;
  }
}

function DatabaseError({ error, ownerId, onRetry }: { error: Error; ownerId: string; onRetry: () => void }) {
  const diagnostic = storeDiagnostic();
  const isolationFailure = diagnostic?.isolationBroken === true;
  const [opfs, setOpfs] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);

  async function rebuild() {
    setRebuilding(true);
    setRebuildError(null);
    try {
      await resetDb(ownerId);
      onRetry();
    } catch (cause) {
      setRebuildError(cause instanceof Error ? cause.message : "Could not rebuild the offline store.");
      setRebuilding(false);
    }
  }

  useEffect(() => {
    let active = true;
    void probeOpfs().then((state) => {
      if (active) setOpfs(state);
    });
    return () => {
      active = false;
    };
  }, []);

  // Refused storage is not a glitch, so a retry is not the move to offer.
  const storageRefused = opfs?.startsWith("unusable") === true;

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-canvas px-8">
      <Text weight="semibold" className="text-center text-base">
        Field Tools cannot open its offline store
      </Text>
      <Text tone="secondary" className="text-center text-sm">
        {storageRefused
          ? "This browser is not keeping any storage for Field Tools, which is what private browsing does. Leave private browsing, or install Field Tools from your browser's share menu, and your records will save again."
          : isolationFailure
            ? "This browser could not start the offline store. Reload once; if it keeps happening, open Field Tools in the mobile app and send support the line below."
            : "Try opening the store again. Your saved records have not been deleted. If this keeps happening, share the message below with support."}
      </Text>
      <Text selectable tone="muted" className="text-center text-xs">{error.message}</Text>
      {diagnostic ? (
        <Text selectable tone="muted" className="text-center text-xs">
          {diagnostic.detail}
          {opfs ? ` · OPFSRoot=${opfs}` : ""}
        </Text>
      ) : null}
      <Button onPress={onRetry}>Try again</Button>
      <Text tone="muted" className="text-center text-xs">
        If trying again keeps failing, the store itself is broken and can be rebuilt. Anything on
        this device that has not uploaded yet is lost with it.
      </Text>
      <Button variant="secondary" loading={rebuilding} onPress={() => void rebuild()}>
        Rebuild offline store
      </Button>
      {rebuildError ? (
        <Text selectable tone="danger" className="text-center text-xs">{rebuildError}</Text>
      ) : null}
    </View>
  );
}

function MigratedDatabase({ db, ownerId, children, onRetry }: { db: Db; ownerId: string; children: ReactNode; onRetry: () => void }) {
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

  if (error) return <DatabaseError error={error} ownerId={ownerId} onRetry={onRetry} />;
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
  if (opened.error) return <DatabaseError error={opened.error} ownerId={ownerId} onRetry={retry} />;
  if (!opened.db) return <View className="flex-1 items-center justify-center bg-canvas"><Spinner /></View>;
  return <MigratedDatabase key={attempt} db={opened.db} ownerId={ownerId} onRetry={retry}>{children}</MigratedDatabase>;
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

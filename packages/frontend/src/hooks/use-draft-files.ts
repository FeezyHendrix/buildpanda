import { useEffect, useState } from "react";
import { useSession } from "@/stores/auth";
import { readDraftFiles, writeDraftFiles } from "@/lib/file-drafts";

const EMPTY_FILES: File[] = [];

export function useDraftFiles(name: string) {
  const { data: session } = useSession();
  const key = `${session?.user.id ?? "anonymous"}:${name}`;
  const [files, setFiles] = useState<File[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readDraftFiles(key).then(value => {
      if (!cancelled) { setFiles(value); setLoadedKey(key); }
    }).catch(() => {
      if (!cancelled) { setFiles(EMPTY_FILES); setError(true); setLoadedKey(key); }
    });
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    if (loadedKey !== key) return;
    let cancelled = false;
    setSaved(false);
    writeDraftFiles(key, files).then(() => {
      if (!cancelled) { setSaved(true); setError(false); }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [files, key, loadedKey]);

  async function clear() {
    await writeDraftFiles(key, []).catch(() => setError(true));
    setFiles([]);
  }

  const ready = loadedKey === key;
  return { clear, files: ready ? files : EMPTY_FILES, setFiles, ready, saved: ready && saved, error };
}

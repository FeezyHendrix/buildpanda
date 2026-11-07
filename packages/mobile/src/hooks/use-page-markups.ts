import { useCallback, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { drawingMarkupApi, type DrawingMarkupComment } from "@/api/drawing-markup";
import type { Db } from "@/db/client";
import { drawingMarkupsRepository, toMarkup, toComment } from "@/db/drawing-markups-repository";
import { useSyncState } from "@/lib/sync-provider";

const REFRESH_INTERVAL_MS = 30_000;

/** Local annotations remain visible offline; an open plan refreshes on reconnect and foreground. */
export function usePageMarkups(
  db: Db,
  projectId: string,
  sheetId: string | undefined,
  versionId: string | null,
  pageNo: number,
) {
  const { isOnline } = useSyncState();
  const [revision, setRevision] = useState(0);
  const markupQuery = useMemo(
    () => drawingMarkupsRepository.pageQuery(db, versionId ?? "__none__", pageNo),
    [db, versionId, pageNo],
  );
  const commentQuery = useMemo(
    () => drawingMarkupsRepository.pageCommentsQuery(db, versionId ?? "__none__", pageNo),
    [db, versionId, pageNo],
  );
  // Subscribe to both tables: a reply can arrive without changing its parent markup.
  const liveMarkups = useLiveQuery(markupQuery, [markupQuery, revision]);
  const liveComments = useLiveQuery(commentQuery, [commentQuery, revision]);
  const markups = useMemo(() => {
    const byMarkup = new Map<string, DrawingMarkupComment[]>();
    for (const row of liveComments.data ?? []) {
      const list = byMarkup.get(row.markupId) ?? [];
      list.push(toComment(row));
      byMarkup.set(row.markupId, list);
    }
    return (liveMarkups.data ?? [])
      .filter((row) => row.documentVersionId === versionId && row.pageNo === pageNo)
      .map(toMarkup)
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .map((row) => ({ ...row, comments: byMarkup.get(row.id) ?? [] }));
  }, [liveMarkups.data, liveComments.data, versionId, pageNo]);

  useFocusEffect(
    useCallback(() => {
      if (!isOnline || !sheetId || !versionId) return;
      let cancelled = false;
      let refreshing = false;
      async function refresh() {
        if (cancelled || refreshing || (AppState.currentState && AppState.currentState !== "active")) return;
        refreshing = true;
        try {
          const rows = await drawingMarkupApi.listForVersion(projectId, versionId!, pageNo);
          if (cancelled) return;
          await drawingMarkupsRepository.replacePage(
            db,
            versionId!,
            pageNo,
            rows.filter(
              (row) => row.documentId === sheetId && row.documentVersionId === versionId && row.pageNo === pageNo,
            ),
          );
          if (!cancelled) setRevision((value) => value + 1);
        } catch {
          // Connectivity can disappear after the probe; the local copy stays visible.
        } finally {
          refreshing = false;
        }
      }
      void refresh();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void refresh();
      });
      const timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
      return () => {
        cancelled = true;
        subscription.remove();
        clearInterval(timer);
      };
    }, [db, projectId, sheetId, versionId, pageNo, isOnline]),
  );

  const readLocal = useCallback(async () => setRevision((value) => value + 1), []);
  return { markups, readLocal, reset: readLocal };
}

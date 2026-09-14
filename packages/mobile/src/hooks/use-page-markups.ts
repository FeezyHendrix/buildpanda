import { useCallback, useEffect, useState } from "react";
import { drawingMarkupApi, type DrawingMarkup } from "@/api/drawing-markup";
import type { Db } from "@/db/client";
import { drawingMarkupsRepository } from "@/db/drawing-markups-repository";

/**
 * The markups on one page of one sheet revision.
 *
 * Local first, so a sheet marked up in a basement still shows its markups.
 * The server's copy refreshes what is not still queued; losing signal here is
 * not an error, it is the normal case this app is built for.
 */
export function usePageMarkups(db: Db, projectId: string, sheetId: string | undefined, versionId: string | null, pageNo: number) {
  const [markups, setMarkups] = useState<DrawingMarkup[]>([]);

  const readLocal = useCallback(async () => {
    if (!versionId) return;
    setMarkups(await drawingMarkupsRepository.pageWithComments(db, versionId, pageNo));
  }, [db, versionId, pageNo]);

  useEffect(() => {
    if (!versionId || !sheetId) return;
    let cancelled = false;
    void readLocal();
    drawingMarkupApi
      .listForVersion(projectId, versionId, pageNo)
      .then(async (rows) => {
        if (cancelled) return;
        await drawingMarkupsRepository.replacePage(
          db,
          versionId,
          pageNo,
          rows.map((r) => ({
            id: r.id,
            projectId,
            documentId: r.documentId,
            documentVersionId: r.documentVersionId,
            pageNo: r.pageNo,
            kind: r.kind,
            geometry: r.geometry,
            color: r.color,
            resolvedAt: r.resolvedAt,
            comments: r.comments,
          })),
        );
        if (!cancelled) await readLocal();
      })
      .catch((err: unknown) => console.warn("markup refresh deferred, working from the local copy", err));
    return () => {
      cancelled = true;
    };
  }, [db, projectId, versionId, sheetId, pageNo, readLocal]);

  const reset = useCallback(() => setMarkups([]), []);

  return { markups, readLocal, reset };
}

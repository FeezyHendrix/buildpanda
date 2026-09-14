import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import type { Db } from "@/db/client";
import { cacheDocument } from "@/lib/download-file";

// A sheet reaches the canvas as bytes, never a URL: the field app reads plans
// it downloaded before it lost signal. A picture goes in as a data URI, a PDF
// as base64 for pdf.js.

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

export interface SheetSource {
  pdfBase64: string | null;
  imageDataUri: string | null;
}

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

/** The active sheet's bytes from the local cache, reloaded when the sheet changes. */
export function useSheetSource(
  db: Db,
  projectId: string,
  sheetId: string | undefined,
  fileName: string,
  onError: (message: string) => void,
): { source: SheetSource | null; reset: () => void } {
  const [source, setSource] = useState<SheetSource | null>(null);

  useEffect(() => {
    if (!sheetId || !fileName) return;
    let cancelled = false;
    setSource(null);
    (async () => {
      const uri = await cacheDocument(db, projectId, sheetId);
      if (!uri || cancelled) return;
      const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
      if (cancelled) return;
      const mime = IMAGE_MIME[extensionOf(fileName)];
      setSource(mime ? { pdfBase64: null, imageDataUri: `data:${mime};base64,${base64}` } : { pdfBase64: base64, imageDataUri: null });
    })().catch((err: unknown) => {
      if (cancelled) return;
      console.error("plan review sheet load failed", err);
      onError(
        err instanceof Error && err.message
          ? `Couldn't load this sheet: ${err.message}`
          : "Couldn't load this sheet. Try again when you have signal.",
      );
    });
    return () => {
      cancelled = true;
    };
    // onError is a setState from the screen; re-running on its identity would reload the sheet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, projectId, sheetId, fileName]);

  return { source, reset: () => setSource(null) };
}

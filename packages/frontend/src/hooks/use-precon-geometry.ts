import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  preconApi,
  preconViewerApi,
  type CreateMeasurementBody,
  type PreconGeometryKind,
  type PreconSnapshot,
  type SheetViewport,
} from "@/api/precon";
import { preconKeys } from "@/hooks/query-keys";
import { useRowMutation } from "@/hooks/use-precon-rows";

export function useUpdatePreconGeometry(sessionId: string) {
  return useRowMutation(
    sessionId,
    ({
      rowId,
      version,
      kind,
      vertices,
      sheetId,
    }: {
      rowId: string;
      version: number;
      kind: PreconGeometryKind;
      vertices: number[][];
      sheetId?: string;
    }) => preconApi.updateGeometry(rowId, { version, kind, vertices, sheetId }),
  );
}

export function useAddPreconDeduction(sessionId: string) {
  return useRowMutation(
    sessionId,
    ({
      rowId,
      version,
      label,
      vertices,
      sheetId,
    }: {
      rowId: string;
      version: number;
      label: string;
      vertices: number[][];
      sheetId?: string;
    }) => preconApi.addDeduction(rowId, { version, label, vertices, sheetId }),
  );
}

// ---- manual measurements (WS-M1B) ----

/**
 * A hand-drawn line lands in the bill at once: the new row and its geometry are
 * written into the snapshot before the refetch so the viewer can select and
 * highlight it without a flash of "nothing measured".
 */
export function useCreateMeasurement(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMeasurementBody) => preconApi.createMeasurement(sessionId, body),
    onSuccess: ({ row, geometry }) => {
      qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), (prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.some((r) => r.id === row.id) ? prev.rows.map((r) => (r.id === row.id ? row : r)) : [...prev.rows, row],
              geometries: [...prev.geometries.filter((g) => g.id !== geometry.id), geometry],
            }
          : prev,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

// ---- WS-M2B · viewer tools ----

/** Room fill: the enclosed space around a click, as a polygon the composer can name. */
export function useRoomAt(sheetId: string | null) {
  return useMutation({ mutationFn: (pt: { x: number; y: number }) => preconViewerApi.roomAt(sheetId!, pt) });
}

/** Find symbol: every match on the sheet of the symbol inside a dragged box. */
export function useSymbolMatches(sheetId: string | null) {
  return useMutation({ mutationFn: (rect: [number, number, number, number]) => preconViewerApi.symbolMatches(sheetId!, rect) });
}

/** The sheet's viewports, replaced whole; the returned sheet replaces the cached one. */
export function useUpdateSheetViewports(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sheetId, viewports }: { sheetId: string; viewports: SheetViewport[] }) => preconViewerApi.updateViewports(sheetId, viewports),
    onSuccess: (sheet) => {
      qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), (prev) => (prev ? { ...prev, sheets: prev.sheets.map((s) => (s.id === sheet.id ? sheet : s)) } : prev));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

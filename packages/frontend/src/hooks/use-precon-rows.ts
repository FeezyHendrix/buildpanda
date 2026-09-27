import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  preconApi,
  preconViewerApi,
  type CreateRowInput,
  type PreconSnapshot,
  type UpdateRowInput,
} from "@/api/precon";
import { preconKeys } from "@/hooks/query-keys";

/**
 * Every bill-line write settles the same way: refetch the snapshot. Shared with
 * the geometry hooks and the settings hook; not meant to be called from a page.
 */
export function useRowMutation<TVariables>(sessionId: string, mutationFn: (variables: TVariables) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

// Batch verify: one request per row, sequential so version conflicts surface
// per row instead of a partial failure hiding inside Promise.all.
export function useVerifyPreconRows(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { rowId: string; version: number }[]) => {
      let done = 0;
      for (const row of rows) {
        await preconApi.verifyRow(row.rowId, row.version);
        done++;
      }
      return done;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

export function useUpdatePreconRow(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, input }: { rowId: string; input: UpdateRowInput }) =>
      preconApi.updateRow(rowId, input),
    onMutate: async ({ rowId, input }) => {
      await qc.cancelQueries({ queryKey: preconKeys.snapshot(sessionId) });
      const previous = qc.getQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId));
      if (previous) {
        qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), {
          ...previous,
          rows: previous.rows.map((r) =>
            r.id === rowId ? { ...r, ...input.changes } : r
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(preconKeys.snapshot(sessionId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
    },
  });
}

export function useVerifyPreconRow(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, version }: { rowId: string; version: number }) =>
      preconApi.verifyRow(rowId, version),
    onMutate: async ({ rowId }) => {
      await qc.cancelQueries({ queryKey: preconKeys.snapshot(sessionId) });
      const previous = qc.getQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId));
      if (previous) {
        qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), {
          ...previous,
          rows: previous.rows.map((r) =>
            r.id === rowId ? { ...r, status: "verified" } : r
          ),
          progress: {
            ...previous.progress,
            verified: previous.progress.verified + (previous.rows.find(r => r.id === rowId)?.status !== "verified" ? 1 : 0)
          }
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(preconKeys.snapshot(sessionId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
    },
  });
}

export function useRejectPreconRow(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, version }: { rowId: string; version: number }) =>
      preconApi.rejectRow(rowId, version),
    onMutate: async ({ rowId }) => {
      await qc.cancelQueries({ queryKey: preconKeys.snapshot(sessionId) });
      const previous = qc.getQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId));
      if (previous) {
        qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), {
          ...previous,
          rows: previous.rows.map((r) =>
            r.id === rowId ? { ...r, status: "rejected" } : r
          ),
          progress: {
            ...previous.progress,
            verified: previous.progress.verified - (previous.rows.find(r => r.id === rowId)?.status === "verified" ? 1 : 0)
          }
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(preconKeys.snapshot(sessionId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
    },
  });
}

export function useCreatePreconBill(sessionId: string) {
  return useRowMutation(sessionId, (title: string) => preconApi.createBill(sessionId, title));
}

export function useRenamePreconBill(sessionId: string) {
  return useRowMutation(sessionId, ({ billId, title }: { billId: string; title: string }) =>
    preconApi.renameBill(billId, title),
  );
}

export function useDeletePreconBill(sessionId: string) {
  return useRowMutation(sessionId, (billId: string) => preconApi.deleteBill(billId));
}

export function useCreatePreconRow(sessionId: string) {
  return useRowMutation(sessionId, ({ billId, input }: { billId: string; input: CreateRowInput }) =>
    preconApi.createRow(billId, input),
  );
}

export function useDeletePreconRow(sessionId: string) {
  return useRowMutation(sessionId, (rowId: string) => preconApi.deleteRow(rowId));
}

/** Typical ×N on a bill line; the returned row (qty and basis recomputed) replaces the cached one. */
export function useSetTypical(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, version, typical }: { rowId: string; version: number; typical: number }) => preconViewerApi.setTypical(rowId, { version, typical }),
    onSuccess: (row) => {
      qc.setQueryData<PreconSnapshot>(preconKeys.snapshot(sessionId), (prev) => (prev ? { ...prev, rows: prev.rows.map((r) => (r.id === row.id ? row : r)) } : prev));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) }),
  });
}

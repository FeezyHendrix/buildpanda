import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { materialApprovalsApi } from "@/api/material-approvals";
import type { Db } from "@/db/client";
import {
  materialApprovalCommentsRepository,
  toApprovalComment,
  type ApprovalCommentDraft,
} from "@/db/material-approval-comments-repository";
import {
  materialApprovalsRepository,
  toMaterialApproval,
  MATERIAL_APPROVALS_RESOURCE,
  type ApprovalDecisionInput,
  type MaterialApprovalDraft,
} from "@/db/material-approvals-repository";
import { flushOutbox, hasPendingCreates } from "@/db/outbox";

/**
 * Requests from SQLite, refreshed in the background.
 *
 * The pull is skipped while a create is still queued: the server would return
 * its own copy under a different id while the `local_` placeholder is still on
 * screen, and the crew member would see the same request twice.
 */
export function useLocalMaterialApprovals(db: Db, projectId: string) {
  const query = useMemo(
    () => materialApprovalsRepository.listQuery(db, projectId),
    [db, projectId],
  );
  const live = useLiveQuery(query);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (await hasPendingCreates(db, MATERIAL_APPROVALS_RESOURCE)) return;
      try {
        const rows = await materialApprovalsApi.list(projectId);
        if (!cancelled) await materialApprovalsRepository.upsertFromServer(db, projectId, rows);
      } catch {
        // Offline: the cached rows are already on screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, projectId]);

  const data = useMemo(() => (live.data ?? []).map(toMaterialApproval), [live.data]);
  return { data, isPending: live.data === undefined };
}

export function useLocalMaterialApproval(db: Db, projectId: string, approvalId: string) {
  const { data, isPending } = useLocalMaterialApprovals(db, projectId);
  const approval = useMemo(() => data.find((row) => row.id === approvalId), [data, approvalId]);
  return { approval, isPending };
}

export function useLocalMaterialApprovalComments(db: Db, projectId: string, approvalId: string) {
  const query = useMemo(
    () => materialApprovalCommentsRepository.listQuery(db, approvalId),
    [db, approvalId],
  );
  const live = useLiveQuery(query);

  useEffect(() => {
    // A queued request has no server id yet, so there is nothing to fetch.
    if (approvalId.startsWith("local_")) return;
    let cancelled = false;
    materialApprovalsApi
      .detail(projectId, approvalId)
      .then(async (detail) => {
        if (cancelled) return;
        await materialApprovalsRepository.upsertFromServer(db, projectId, [detail]);
        await materialApprovalCommentsRepository.upsertFromServer(db, projectId, detail.comments);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId, approvalId]);

  const data = useMemo(() => (live.data ?? []).map(toApprovalComment), [live.data]);
  return { data, isPending: live.data === undefined };
}

export function useCreateMaterialApproval(db: Db | null, projectId: string | undefined) {
  return async (draft: MaterialApprovalDraft) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    const id = await materialApprovalsRepository.createLocal(db, projectId, draft);
    // The row is already durable, so a failed push just leaves it queued.
    void flushOutbox(db).catch(() => undefined);
    return id;
  };
}

export function useDecideMaterialApproval(db: Db | null, projectId: string | undefined) {
  return async (approvalId: string, decision: ApprovalDecisionInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await materialApprovalsRepository.decideLocal(db, projectId, approvalId, decision);
    void flushOutbox(db).catch(() => undefined);
  };
}

export function useAddMaterialApprovalComment(db: Db | null, projectId: string | undefined) {
  return async (comment: ApprovalCommentDraft) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await materialApprovalCommentsRepository.createLocal(db, projectId, comment);
    void flushOutbox(db).catch(() => undefined);
  };
}

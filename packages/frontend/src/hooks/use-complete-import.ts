import { useState } from "react";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAttachSessionDocument, useImportSession, useLinkSessionProject, useUpdateSessionDocument, type SessionDocumentKind } from "./use-import-session";

interface ImportCompletion {
  sessionId: string;
  jobId: string | null;
  kind: SessionDocumentKind;
  fileName?: string;
  projectId: string | null;
  onProjectCreated: (id: string) => void;
  onNext: () => void;
}

/** Retry the unfinished handoff without applying the same file twice. */
export function useCompleteImport({ sessionId, jobId, kind, fileName, projectId, onProjectCreated, onNext }: ImportCompletion) {
  const session = useImportSession(sessionId);
  const link = useLinkSessionProject();
  const attach = useAttachSessionDocument();
  const update = useUpdateSessionDocument();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function complete(apply: () => Promise<{ projectId: string }>) {
    if (!jobId || pending) return;
    setPending(true);
    setError(null);
    try {
      const id = projectId ?? (await apply()).projectId;
      onProjectCreated(id);
      if (session.data?.projectId !== id) await link.mutateAsync({ sessionId, projectId: id });
      const document = session.data?.documents.find(document => document.kind === kind && document.jobId === jobId);
      if (!document) await attach.mutateAsync({ sessionId, kind, jobId, fileName, status: "applied" });
      else if (document.status !== "applied") await update.mutateAsync({ sessionId, documentId: document.id, status: "applied", error: null });
      onNext();
    } catch (error) {
      setError(getApiErrorMessage(error, "Could not finish this import. Your progress is saved; please try again."));
    } finally {
      setPending(false);
    }
  }

  return { complete, pending, error };
}

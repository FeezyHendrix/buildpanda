import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type {
  ImportDocumentPatch,
  ImportSessionsRepository,
  NewImportDocumentRecord,
} from "./repository.ts";
import type {
  ImportDocKind,
  ImportDocStatus,
  ImportSession,
  ImportSessionDetail,
  ImportSessionDocument,
  ImportSessionDocumentRow,
  ImportSessionRow,
} from "./types.ts";

const TERMINAL: readonly ImportDocStatus[] = ["applied", "skipped", "failed"];

export interface AttachDocumentInput {
  kind: ImportDocKind;
  jobId?: string | null;
  fileName?: string | null;
  status?: ImportDocStatus;
}

function toDocument(row: ImportSessionDocumentRow): ImportSessionDocument {
  return {
    id: row.id,
    sessionId: row.session_id,
    kind: row.kind,
    jobId: row.job_id,
    fileName: row.file_name,
    status: row.status,
    error: row.error,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
  };
}

function toSession(row: ImportSessionRow): ImportSession {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function importSessionsService(repository: ImportSessionsRepository) {
  async function loadSession(id: string): Promise<ImportSessionRow> {
    const row = await repository.findById(id);
    if (!row) throw new NotFoundError("Import session");
    return row;
  }

  async function detail(id: string): Promise<ImportSessionDetail> {
    const session = await loadSession(id);
    const documents = await repository.listDocuments(id);
    return { ...toSession(session), documents: documents.map(toDocument) };
  }

  async function reconcileStatus(sessionId: string): Promise<void> {
    const documents = await repository.listDocuments(sessionId);
    if (documents.length === 0) {
      await repository.touch(sessionId);
      return;
    }
    const allTerminal = documents.every((doc) => TERMINAL.includes(doc.status));
    await repository.setStatus(sessionId, allTerminal ? "completed" : "active");
  }

  return {
    detail,
    reconcileStatus,

    async create(createdBy: string, projectId: string | null = null): Promise<ImportSession> {
      const row = await repository.create({
        id: generateId("imps"),
        project_id: projectId,
        created_by: createdBy,
      });
      return toSession(row);
    },

    async linkProject(id: string, projectId: string): Promise<ImportSession> {
      await loadSession(id);
      await repository.setProjectId(id, projectId);
      const row = await repository.findById(id);
      if (!row) throw new NotFoundError("Import session");
      return toSession(row);
    },

    async attachDocument(
      sessionId: string,
      input: AttachDocumentInput,
    ): Promise<ImportSessionDocument> {
      await loadSession(sessionId);
      const record: NewImportDocumentRecord = {
        id: generateId("impd"),
        session_id: sessionId,
        kind: input.kind,
        job_id: input.jobId ?? null,
        file_name: input.fileName ?? null,
        status: input.status ?? "pending",
      };
      const row = await repository.addDocument(record);
      await reconcileStatus(sessionId);
      return toDocument(row);
    },

    async updateDocument(
      sessionId: string,
      documentId: string,
      patch: ImportDocumentPatch,
    ): Promise<ImportSessionDocument> {
      const existing = await repository.findDocumentById(documentId);
      if (!existing || existing.session_id !== sessionId) {
        throw new NotFoundError("Import document");
      }
      const next: ImportDocumentPatch = { ...patch };
      if (patch.status && TERMINAL.includes(patch.status) && !existing.applied_at) {
        if (patch.status === "applied") next.applied_at = new Date().toISOString();
      }
      const row = await repository.updateDocument(documentId, next);
      if (!row) throw new NotFoundError("Import document");
      await reconcileStatus(sessionId);
      return toDocument(row);
    },
  };
}

export type ImportSessionsService = ReturnType<typeof importSessionsService>;

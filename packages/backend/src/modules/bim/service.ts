import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { NotificationsService } from "../notifications/service.ts";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  getDownloadUrl,
  getPartUploadUrls,
  getUploadUrl,
  makeStorageKey,
  type MultipartPartUrl,
} from "../../lib/file-storage.ts";
import type { BimRepository } from "./repository.ts";
import type {
  BimCoordinationIssue,
  BimCoordinationIssueRow,
  BimElementLink,
  BimElementLinkRow,
  BimLinkType,
  BimModel,
  BimModelRow,
  BimXktStatus,
} from "./types.ts";

const IFC_CONTENT_TYPE = "application/octet-stream";
const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;
const PART_SIZE_BYTES = 50 * 1024 * 1024;

const LINK_TARGET_TABLE: Record<BimLinkType, string> = {
  phase: "project_phases",
  activity: "activities",
  change_request: "change_requests",
  cost_item: "material_procurements",
};

function toModel(row: BimModelRow): BimModel {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    discipline: row.discipline,
    currentVersionId: row.current_version_id,
    status: row.status,
    elementCount: row.element_count,
    xktStatus: row.xkt_status,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toIssue(row: BimCoordinationIssueRow): BimCoordinationIssue {
  return {
    id: row.id,
    bimModelId: row.bim_model_id,
    elementGuid: row.element_guid,
    position: row.position,
    title: row.title,
    description: row.description,
    status: row.status,
    rfiId: row.rfi_id,
    assigneeId: row.assignee_id,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toLink(row: BimElementLinkRow): BimElementLink {
  return {
    id: row.id,
    bimModelId: row.bim_model_id,
    elementGuid: row.element_guid,
    linkType: row.link_type,
    targetId: row.target_id,
    targetTable: row.target_table,
    createdAt: row.created_at,
  };
}

export interface UploadTicketInput {
  fileName: string;
  sizeBytes: number;
}

export type UploadTicket =
  | { mode: "single"; storagePath: string; url: string }
  | {
      mode: "multipart";
      storagePath: string;
      uploadId: string;
      partSize: number;
      parts: MultipartPartUrl[];
    };

export interface RegisterModelInput {
  name: string;
  discipline?: string | null;
  fileName: string;
  storagePath: string;
  sizeBytes?: number | null;
}

export interface RfiCreator {
  create(
    projectId: string,
    input: { subject: string; question: string },
    actor: { id: string; name: string },
    visibility: "internal" | "shared",
  ): Promise<{ id: string; number: number }>;
}

export function bimService(
  repository: BimRepository,
  enqueueProcessing: (versionId: string) => Promise<void>,
  deps: { rfis?: RfiCreator; notifications?: NotificationsService } = {},
) {
  function notifyIssueAssignee(
    assigneeId: string | null | undefined,
    projectId: string,
    title: string,
    actorId: string,
  ): void {
    if (!deps.notifications || !assigneeId || assigneeId === actorId) return;
    void deps.notifications
      .notify(assigneeId, "bim_issue_assigned", {
        title: "A coordination issue was assigned to you",
        body: title,
        projectId,
      })
      .catch(() => undefined);
  }

  async function loadModel(projectId: string, modelId: string): Promise<BimModelRow> {
    const row = await repository.findModelById(modelId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("BIM model");
    return row;
  }

  return {
    async list(projectId: string): Promise<BimModel[]> {
      return (await repository.listModels(projectId)).map(toModel);
    },

    async get(projectId: string, modelId: string): Promise<BimModel> {
      return toModel(await loadModel(projectId, modelId));
    },

    async createUploadTicket(ownerId: string, input: UploadTicketInput): Promise<UploadTicket> {
      const storagePath = makeStorageKey(ownerId, "bim");
      if (input.sizeBytes <= MULTIPART_THRESHOLD_BYTES) {
        const url = await getUploadUrl(storagePath, IFC_CONTENT_TYPE);
        return { mode: "single", storagePath, url };
      }
      const uploadId = await createMultipartUpload(storagePath, IFC_CONTENT_TYPE);
      const partCount = Math.ceil(input.sizeBytes / PART_SIZE_BYTES);
      const parts = await getPartUploadUrls(storagePath, uploadId, partCount);
      return { mode: "multipart", storagePath, uploadId, partSize: PART_SIZE_BYTES, parts };
    },

    async completeUpload(
      storagePath: string,
      uploadId: string,
      parts: { partNumber: number; etag: string }[],
    ): Promise<void> {
      await completeMultipartUpload(storagePath, uploadId, parts);
    },

    async abortUpload(storagePath: string, uploadId: string): Promise<void> {
      await abortMultipartUpload(storagePath, uploadId);
    },

    async registerModel(
      projectId: string,
      input: RegisterModelInput,
      userId: string,
    ): Promise<BimModel> {
      const model = await repository.createModel({
        id: generateId("bim"),
        project_id: projectId,
        name: input.name,
        discipline: input.discipline ?? null,
        created_by_id: userId,
      });
      const version = await repository.createVersion({
        id: generateId("bimv"),
        bim_model_id: model.id,
        version: 1,
        source_storage_path: input.storagePath,
        source_file_name: input.fileName,
        size_bytes: input.sizeBytes ?? null,
        created_by_id: userId,
      });
      await repository.setCurrentVersion(model.id, version.id);
      await enqueueProcessing(version.id);
      const refreshed = await repository.findModelById(model.id);
      return toModel(refreshed ?? model);
    },

    async addVersion(
      projectId: string,
      modelId: string,
      input: { fileName: string; storagePath: string; sizeBytes?: number | null },
      userId: string,
    ): Promise<BimModel> {
      const model = await loadModel(projectId, modelId);
      const number = await repository.nextVersionNumber(model.id);
      const version = await repository.createVersion({
        id: generateId("bimv"),
        bim_model_id: model.id,
        version: number,
        source_storage_path: input.storagePath,
        source_file_name: input.fileName,
        size_bytes: input.sizeBytes ?? null,
        created_by_id: userId,
      });
      await repository.setCurrentVersion(model.id, version.id);
      await enqueueProcessing(version.id);
      const refreshed = await repository.findModelById(model.id);
      return toModel(refreshed ?? model);
    },

    async modelFileUrl(projectId: string, modelId: string): Promise<{ url: string; fileName: string }> {
      const model = await loadModel(projectId, modelId);
      if (!model.current_version_id) throw new NotFoundError("BIM model version");
      const version = await repository.findVersionById(model.current_version_id);
      if (!version) throw new NotFoundError("BIM model version");
      const url = await getDownloadUrl(version.source_storage_path);
      return { url, fileName: version.source_file_name };
    },

    async modelXktUrl(
      projectId: string,
      modelId: string,
    ): Promise<{ url: string | null; status: BimXktStatus }> {
      const model = await loadModel(projectId, modelId);
      if (!model.current_version_id) throw new NotFoundError("BIM model version");
      const version = await repository.findVersionById(model.current_version_id);
      if (!version) throw new NotFoundError("BIM model version");
      if (version.xkt_status !== "Ready" || !version.xkt_storage_path) {
        return { url: null, status: version.xkt_status };
      }
      const url = await getDownloadUrl(version.xkt_storage_path);
      return { url, status: version.xkt_status };
    },

    async listIssues(projectId: string, modelId: string): Promise<BimCoordinationIssue[]> {
      await loadModel(projectId, modelId);
      return (await repository.listIssues(modelId)).map(toIssue);
    },

    async createIssue(
      projectId: string,
      modelId: string,
      input: {
        title: string;
        description?: string | null;
        elementGuid?: string | null;
        position?: unknown;
        assigneeId?: string | null;
      },
      userId: string,
    ): Promise<BimCoordinationIssue> {
      await loadModel(projectId, modelId);
      const row = await repository.createIssue({
        id: generateId("bimi"),
        bim_model_id: modelId,
        element_guid: input.elementGuid ?? null,
        position: input.position ?? null,
        title: input.title,
        description: input.description ?? null,
        assignee_id: input.assigneeId ?? null,
        created_by_id: userId,
      });
      notifyIssueAssignee(row.assignee_id, projectId, row.title, userId);
      return toIssue(row);
    },

    async listLinks(projectId: string, modelId: string): Promise<BimElementLink[]> {
      await loadModel(projectId, modelId);
      return (await repository.listLinks(modelId)).map(toLink);
    },

    async updateIssue(
      projectId: string,
      modelId: string,
      issueId: string,
      patch: { title?: string; description?: string | null; status?: "Open" | "Closed"; assigneeId?: string | null },
      actorId?: string,
    ): Promise<BimCoordinationIssue> {
      await loadModel(projectId, modelId);
      const existing = await repository.findIssueById(issueId);
      if (!existing || existing.bim_model_id !== modelId) throw new NotFoundError("Coordination issue");
      const row = await repository.updateIssue(issueId, {
        title: patch.title,
        description: patch.description,
        status: patch.status,
        assignee_id: patch.assigneeId,
        updated_at: new Date().toISOString(),
      });
      if (!row) throw new NotFoundError("Coordination issue");
      if (patch.assigneeId !== undefined && patch.assigneeId !== existing.assignee_id) {
        notifyIssueAssignee(row.assignee_id, projectId, row.title, actorId ?? "");
      }
      return toIssue(row);
    },

    async promoteIssueToRfi(
      projectId: string,
      modelId: string,
      issueId: string,
      actor: { id: string; name: string },
    ): Promise<BimCoordinationIssue> {
      await loadModel(projectId, modelId);
      const issue = await repository.findIssueById(issueId);
      if (!issue || issue.bim_model_id !== modelId) throw new NotFoundError("Coordination issue");
      if (issue.rfi_id) {
        return toIssue(issue);
      }
      if (!deps.rfis) throw new NotFoundError("RFI service");
      const rfi = await deps.rfis.create(
        projectId,
        {
          subject: issue.title,
          question: issue.description ?? `Coordination issue on BIM element ${issue.element_guid ?? "(model)"}.`,
        },
        actor,
        "internal",
      );
      const row = await repository.updateIssue(issueId, {
        rfi_id: rfi.id,
        updated_at: new Date().toISOString(),
      });
      if (!row) throw new NotFoundError("Coordination issue");
      return toIssue(row);
    },

    async addLink(
      projectId: string,
      modelId: string,
      input: { elementGuid: string; linkType: BimLinkType; targetId: string },
    ): Promise<BimElementLink> {
      await loadModel(projectId, modelId);
      const targetTable = LINK_TARGET_TABLE[input.linkType];
      const row = await repository.createLink({
        id: generateId("biml"),
        bim_model_id: modelId,
        element_guid: input.elementGuid,
        link_type: input.linkType,
        target_id: input.targetId,
        target_table: targetTable,
      });
      return toLink(row);
    },

    async removeLink(projectId: string, modelId: string, linkId: string): Promise<void> {
      await loadModel(projectId, modelId);
      await repository.removeLink(linkId, modelId);
    },
  };
}

export type BimService = ReturnType<typeof bimService>;

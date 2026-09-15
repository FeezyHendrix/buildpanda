import type { NotificationsService } from "../notifications/service.ts";
import type { Tone } from "../projects/types.ts";

export type DocumentStatus = "Verified" | "Pending" | "Expired";

/** Internal to the delivery team, or issued to the client. */
export const DOCUMENT_VISIBILITIES = ["internal", "shared"] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export type CategoryGroup = "document" | "plan" | "media";

export interface DocumentCategory {
  id: string;
  name: string;
  fileCount: number;
  totalSize: string;
  tone: Tone;
  group: CategoryGroup;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  fileName: string;
  size: string;
  category: string;
  categoryId: string | null;
  group: CategoryGroup;
  uploadedAt: string;
  status: DocumentStatus;
  versionNo: number;
  versionCount: number;
  currentVersionId: string | null;
  title: string | null;
  revision: string | null;
  supersedesId: string | null;
  visibility: DocumentVisibility;
  documentDate: string | null;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNo: number;
  revisionLabel: string | null;
  fileName: string;
  size: string;
  notes: string | null;
  uploadedById: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  tone: Tone;
  group: CategoryGroup;
}

export interface DocumentRow {
  id: string;
  project_id: string;
  category_id: string | null;
  file_id: string | null;
  file_name: string;
  size: string;
  status: DocumentStatus;
  uploaded_at: string;
  current_version_id: string | null;
  title: string | null;
  revision: string | null;
  supersedes_id: string | null;
  visibility: DocumentVisibility;
  document_date: Date | string | null;
}

export interface DocumentVersionRow {
  id: string;
  document_id: string;
  file_id: string | null;
  version_no: number;
  revision_label: string | null;
  file_name: string;
  size: string;
  size_bytes: string | null;
  notes: string | null;
  uploaded_by_id: string | null;
  created_at: string;
}

export interface CategoryAggregateRow {
  id: string;
  name: string;
  tone: Tone;
  group: CategoryGroup;
  file_count: string;
  total_bytes: string | null;
}

export interface DocumentRegisterFields {
  /** The title a person reads; the filename stays the file's own name. */
  title?: string | null;
  /** "Rev C", "P02" — free text; every discipline numbers differently. */
  revision?: string | null;
  /** The document this one replaces, so the register shows the chain. */
  supersedesId?: string | null;
  visibility?: DocumentVisibility;
  /** The date on the document itself, not the day it was uploaded. */
  documentDate?: string | null;
}

export interface CreateDocumentInput extends DocumentRegisterFields {
  categoryId?: string | null;
  fileId?: string;
  fileName?: string;
  size?: string;
  uploadedAt?: string;
  status?: DocumentStatus;
}

export interface EditDocumentInput extends DocumentRegisterFields {
  categoryId?: string;
  fileName?: string;
  status?: DocumentStatus;
}

export interface AddVersionInput {
  fileId: string;
  revisionLabel?: string;
  notes?: string;
}

export interface DocumentsDeps {
  notifications?: NotificationsService;
}

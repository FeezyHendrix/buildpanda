import type { Tone } from "../projects/types.ts";

export type DocumentStatus = "Verified" | "Pending" | "Expired";

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
  total_size: string | null;
}

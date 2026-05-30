import type { Tone } from "../projects/types.ts";

export type DocumentStatus = "Verified" | "Pending" | "Expired";

export interface DocumentCategory {
  id: string;
  name: string;
  fileCount: number;
  totalSize: string;
  tone: Tone;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  fileName: string;
  size: string;
  category: string;
  uploadedAt: string;
  status: DocumentStatus;
}

export interface CategoryRow {
  id: string;
  name: string;
  tone: Tone;
}

export interface DocumentRow {
  id: string;
  project_id: string;
  category_id: string | null;
  file_name: string;
  size: string;
  status: DocumentStatus;
  uploaded_at: string;
}

export interface CategoryAggregateRow {
  id: string;
  name: string;
  tone: Tone;
  file_count: string;
  total_size: string | null;
}

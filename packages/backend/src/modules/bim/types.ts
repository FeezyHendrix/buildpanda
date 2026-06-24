export const BIM_VERSION_STATUSES = ["Processing", "Ready", "Failed"] as const;
export type BimVersionStatus = (typeof BIM_VERSION_STATUSES)[number];

export const BIM_XKT_STATUSES = ["Pending", "Ready", "Failed", "Skipped"] as const;
export type BimXktStatus = (typeof BIM_XKT_STATUSES)[number];

export const BIM_ISSUE_STATUSES = ["Open", "Closed"] as const;
export type BimIssueStatus = (typeof BIM_ISSUE_STATUSES)[number];

export const BIM_LINK_TYPES = ["phase", "activity", "change_request", "cost_item"] as const;
export type BimLinkType = (typeof BIM_LINK_TYPES)[number];

export interface BimModel {
  id: string;
  projectId: string;
  name: string;
  discipline: string | null;
  currentVersionId: string | null;
  status: BimVersionStatus | null;
  elementCount: number | null;
  xktStatus: BimXktStatus | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BimModelVersion {
  id: string;
  bimModelId: string;
  version: number;
  sourceFileName: string;
  status: BimVersionStatus;
  failureReason: string | null;
  sizeBytes: number | null;
  elementCount: number | null;
  xktStatus: BimXktStatus;
  createdAt: string;
}

export interface BimCoordinationIssue {
  id: string;
  bimModelId: string;
  elementGuid: string | null;
  position: unknown;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  status: BimIssueStatus;
  rfiId: string | null;
  assigneeId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BimElementLink {
  id: string;
  bimModelId: string;
  elementGuid: string;
  linkType: BimLinkType;
  targetId: string;
  targetTable: string;
  createdAt: string;
}

export interface BimModelRow {
  id: string;
  project_id: string;
  name: string;
  discipline: string | null;
  current_version_id: string | null;
  status: BimVersionStatus | null;
  element_count: number | null;
  xkt_status: BimXktStatus | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BimModelVersionRow {
  id: string;
  bim_model_id: string;
  version: number;
  source_storage_path: string;
  source_file_name: string;
  status: BimVersionStatus;
  failure_reason: string | null;
  size_bytes: number | null;
  element_count: number | null;
  xkt_storage_path: string | null;
  xkt_status: BimXktStatus;
  created_by_id: string | null;
  created_at: string;
}

export interface BimCoordinationIssueRow {
  id: string;
  bim_model_id: string;
  element_guid: string | null;
  position: unknown;
  title: string;
  description: string | null;
  description_html: string | null;
  status: BimIssueStatus;
  rfi_id: string | null;
  assignee_id: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BimElementLinkRow {
  id: string;
  bim_model_id: string;
  element_guid: string;
  link_type: BimLinkType;
  target_id: string;
  target_table: string;
  created_at: string;
}

export interface BimElementRecord {
  id: string;
  model_version_id: string;
  guid: string;
  express_id: number | null;
  ifc_type: string | null;
  name: string | null;
}

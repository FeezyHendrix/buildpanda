// The drawings attached to a proposal, and the bill of quantities read off
// them, as types.
//
// Split from `types.ts` at the house 400-line ceiling. `types.ts` re-exports
// the lot, so no importer had to move.

import type { PlanDiscipline, PlanRevisionStatus } from "./types.ts";

export interface ProposalPlanRow {
  id: string;
  proposal_id: string;
  file_id: string;
  label: string | null;
  sheet_code: string | null;
  discipline: PlanDiscipline | null;
  revision: string | null;
  revision_status: PlanRevisionStatus;
  supersedes_plan_id: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  sort: number;
}

export interface ProposalPlan {
  id: string;
  proposalId: string;
  fileId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  label: string | null;
  sheetCode: string | null;
  discipline: PlanDiscipline | null;
  revision: string | null;
  revisionStatus: PlanRevisionStatus;
  supersedesPlanId: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  sort: number;
}

export interface CreateProposalPlanInput {
  fileId: string;
  label?: string;
  sheetCode?: string;
  discipline?: PlanDiscipline;
  revision?: string;
}

export interface UpdateProposalPlanInput {
  label?: string | null;
  sheetCode?: string | null;
  discipline?: PlanDiscipline | null;
  revision?: string | null;
}

export interface ProposalBoqItemRow {
  id: string;
  proposal_id: string;
  group_label: string;
  description: string;
  description_html: string | null;
  qty: number | string;
  unit: string;
  sort: number;
}

export interface ProposalBoqItem {
  id: string;
  proposalId: string;
  groupLabel: string;
  description: string;
  descriptionHtml: string | null;
  qty: number;
  unit: string;
  sort: number;
}

export interface CreateBoqItemInput {
  groupLabel: string;
  description: string;
  descriptionHtml?: string | null;
  qty: number;
  unit: string;
  sort?: number;
}

// ---------- proposal → project handoff ----------

// Proposal templates, as types.
//
// Split from `types.ts` at the house 400-line ceiling. A template is a saved
// shape of a proposal — its pack sections, its schedule and its terms — and is
// named only by the save/create-from flow. `types.ts` re-exports the lot, so no
// importer had to move.

import type { CreateProposalInput, JobProfile } from "./types.ts";

export const TEMPLATE_PACK_KINDS = [
  "scope",
  "exclusions",
  "assumptions",
  "provisional_sums",
  "warranties",
  "terms",
  "site_survey",
] as const;
export type TemplatePackKind = (typeof TEMPLATE_PACK_KINDS)[number];

export interface TemplatePackSection {
  kind: TemplatePackKind;
  bodyHtml: string;
  sort: number;
}

export interface TemplateScheduleItem {
  label: string;
  percent: number;
  description: string | null;
  kind: "advance" | "stage";
  sort: number;
}

// Mirrors the estimate terms columns WS-4 adds; every field is optional so a
// template saved before those columns exist still applies cleanly.
export interface TemplateTerms {
  retentionPct?: number | null;
  retentionMode?: "none" | "cash" | "bond" | null;
  advancePct?: number | null;
  whtPct?: number | null;
  paymentTermsDays?: number | null;
  defectsLiabilityDays?: number | null;
  clientVisibleDetail?: "groups" | "lines" | null;
  validDays?: number | null;
}

export interface ProposalTemplateRow {
  id: string;
  org_id: string;
  name: string;
  job_profile: JobProfile;
  pack_sections: TemplatePackSection[];
  payment_schedule: TemplateScheduleItem[];
  terms: TemplateTerms;
  contingency_pct: number | string;
  tax_label: string | null;
  tax_pct: number | string;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ProposalTemplate {
  id: string;
  name: string;
  jobProfile: JobProfile;
  packSections: TemplatePackSection[];
  paymentSchedule: TemplateScheduleItem[];
  terms: TemplateTerms;
  contingencyPct: number;
  taxLabel: string | null;
  taxPct: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTemplateInput {
  proposalId: string;
  name: string;
}

export interface CreateFromTemplateInput extends CreateProposalInput {
  templateId: string;
}

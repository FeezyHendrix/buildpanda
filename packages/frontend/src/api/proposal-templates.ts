import api from "./client";
import type { CreateProposalInput, Estimate, Proposal } from "./proposals";

export const JOB_PROFILES = ["full_contract", "labour_only", "supply_only"] as const;
export type JobProfile = (typeof JOB_PROFILES)[number];

export const JOB_PROFILE_LABEL: Record<JobProfile, string> = {
  full_contract: "Full contract",
  labour_only: "Labour only",
  supply_only: "Supply only",
};

export type TemplatePackKind =
  | "scope"
  | "exclusions"
  | "assumptions"
  | "provisional_sums"
  | "warranties"
  | "terms"
  | "site_survey";

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

export interface CreateFromTemplateInput extends CreateProposalInput {
  templateId: string;
}

export const proposalTemplatesApi = {
  list: () => api.get<ProposalTemplate[]>("/proposals/templates").then((r) => r.data),
  saveFromProposal: (proposalId: string, name: string) =>
    api.post<ProposalTemplate>("/proposals/templates", { proposalId, name }).then((r) => r.data),
  rename: (templateId: string, name: string) =>
    api.patch<ProposalTemplate>(`/proposals/templates/${templateId}`, { name }).then((r) => r.data),
  remove: (templateId: string) => api.delete(`/proposals/templates/${templateId}`).then((r) => r.data),
  createProposal: (body: CreateFromTemplateInput) =>
    api
      .post<{ proposal: Proposal; estimate: Estimate; template: ProposalTemplate }>("/proposals/from-template", body)
      .then((r) => r.data),
};

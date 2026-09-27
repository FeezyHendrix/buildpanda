import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { ProposalsRepository } from "./repository.ts";
import type { ProposalTemplatesRepository } from "./templates-repository.ts";
import type {
  CreateFromTemplateInput,
  Estimate,
  Proposal,
  ProposalTemplate,
  ProposalTemplateRow,
  SaveTemplateInput,
} from "./types.ts";

/** The two proposal-service calls a template needs; injected so tests can fake them. */
export interface ProposalFactory {
  createProposal(orgId: string, userId: string, input: CreateFromTemplateInput): Promise<Proposal>;
  createEstimateRevision(
    proposalId: string,
    orgId: string,
    userId: string,
    opts: { changeNote?: string; orgTaxLabel?: string; orgTaxPct?: number },
  ): Promise<Estimate>;
}

export function toTemplate(r: ProposalTemplateRow): ProposalTemplate {
  return {
    id: r.id,
    name: r.name,
    jobProfile: r.job_profile,
    packSections: r.pack_sections ?? [],
    paymentSchedule: r.payment_schedule ?? [],
    terms: r.terms ?? {},
    contingencyPct: Number(r.contingency_pct),
    taxLabel: r.tax_label,
    taxPct: Number(r.tax_pct),
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export function proposalTemplatesService(
  repo: ProposalTemplatesRepository,
  proposals: Pick<ProposalsRepository, "getById" | "getActiveEstimate">,
  factory: ProposalFactory,
) {
  async function assertOwned(orgId: string, id: string): Promise<ProposalTemplateRow> {
    const row = await repo.byId(id);
    if (!row || row.org_id !== orgId) throw new NotFoundError("Proposal template");
    return row;
  }

  return {
    async list(orgId: string): Promise<ProposalTemplate[]> {
      return (await repo.listByOrg(orgId)).map(toTemplate);
    },

    // A template is a snapshot of the reusable half of an offer: pack text,
    // payment stages, terms and tax settings. Line items and prices stay with
    // the proposal they were measured for.
    async saveFromProposal(orgId: string, userId: string, input: SaveTemplateInput): Promise<ProposalTemplate> {
      const name = input.name.trim();
      if (!name) throw new BadRequestError("Give the template a name");
      const proposal = await proposals.getById(input.proposalId, orgId);
      if (!proposal) throw new NotFoundError("Proposal");
      const estimate = await proposals.getActiveEstimate(input.proposalId);
      if (!estimate) throw new BadRequestError("This proposal has no estimate to save as a template");
      const snapshot = await repo.snapshotEstimate(input.proposalId, estimate.id);
      const jobProfile = (await repo.proposalJobProfile(input.proposalId)) ?? "full_contract";
      const row = await repo.insert({
        id: generateId("ptpl"),
        org_id: orgId,
        name,
        job_profile: jobProfile,
        pack_sections: snapshot.packSections,
        payment_schedule: snapshot.schedule,
        terms: snapshot.terms,
        contingency_pct: snapshot.contingencyPct,
        tax_label: snapshot.taxLabel,
        tax_pct: snapshot.taxPct,
        created_by: userId,
      });
      return toTemplate(row);
    },

    async rename(orgId: string, id: string, name: string): Promise<ProposalTemplate> {
      await assertOwned(orgId, id);
      const trimmed = name.trim();
      if (!trimmed) throw new BadRequestError("Give the template a name");
      return toTemplate((await repo.rename(id, trimmed))!);
    },

    async remove(orgId: string, id: string): Promise<{ ok: true }> {
      await assertOwned(orgId, id);
      await repo.delete(id, orgId);
      return { ok: true };
    },

    // Creates the proposal and its first revision the normal way, then lays the
    // template over the revision, so every rule the plain path enforces holds.
    async createProposalFromTemplate(
      orgId: string,
      userId: string,
      input: CreateFromTemplateInput,
    ): Promise<{ proposal: Proposal; estimate: Estimate; template: ProposalTemplate }> {
      const tpl = await assertOwned(orgId, input.templateId);
      const proposal = await factory.createProposal(orgId, userId, input);
      const estimate = await factory.createEstimateRevision(proposal.id, orgId, userId, {
        orgTaxLabel: tpl.tax_label ?? undefined,
        orgTaxPct: Number(tpl.tax_pct),
      });
      await repo.applyToEstimate(
        proposal.id,
        estimate.id,
        tpl,
        tpl.payment_schedule.map(() => generateId("sched")),
        tpl.pack_sections.map(() => generateId("pps")),
        userId,
      );
      await repo.setProposalJobProfile(proposal.id, tpl.job_profile);
      return { proposal, estimate, template: toTemplate(tpl) };
    },
  };
}

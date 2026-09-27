import type { ProposalsRepository } from "./repository.ts";
import type { EstimateItemsService } from "./estimate-items-service.ts";
import type {
  CreateProposalInput,
  CreateEstimateItemInput,
  CreateProposalPlanInput,
  UpdateProposalPlanInput,
} from "./types.ts";
import { generateId } from "../../lib/ids.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";

// `estimates` is the transaction-bound seam that owns every write to an
// estimate's lines, meta and status. This service never writes them directly:
// doing so would step outside the estimate's row lock.
export function proposalsService(repo: ProposalsRepository, estimates: EstimateItemsService) {
  async function createProposal(
    orgId: string,
    userId: string,
    input: CreateProposalInput,
  ) {
    const number = await repo.allocateNumber(orgId);
    return repo.insertProposal({
      id: generateId("prop"),
      orgId,
      number,
      title: input.title,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone,
      location: input.location,
      brief: input.brief,
      currency: input.currency ?? "NGN",
      validUntil: input.validUntil,
      leadId: input.leadId,
      jobProfile: input.jobProfile,
      createdBy: userId,
    });
  }

  // A drawing revision never replaces a file: uploading the same sheet code
  // marks the previous current revision superseded and links the pair, so a
  // take-off measured on the old revision keeps pointing at what it measured.
  async function addPlan(proposalId: string, orgId: string, userId: string, input: CreateProposalPlanInput) {
    const proposal = await repo.getById(proposalId, orgId);
    if (!proposal) throw new NotFoundError("Proposal");
    const sheetCode = input.sheetCode?.trim() || null;
    const previous = sheetCode ? await repo.findCurrentPlanBySheetCode(proposalId, sheetCode) : null;
    const existing = await repo.listPlans(proposalId);
    const id = generateId("plan");
    await repo.insertPlan({
      id,
      proposalId,
      fileId: input.fileId,
      label: input.label?.trim() || null,
      sheetCode,
      discipline: input.discipline ?? null,
      revision: input.revision?.trim() || null,
      uploadedBy: userId,
      sort: existing.length,
    });
    if (previous) await repo.supersedePlan(previous.id, id);
    return repo.listPlans(proposalId);
  }

  async function updatePlan(proposalId: string, orgId: string, planId: string, input: UpdateProposalPlanInput) {
    const proposal = await repo.getById(proposalId, orgId);
    if (!proposal) throw new NotFoundError("Proposal");
    const updated = await repo.updatePlan(planId, proposalId, {
      label: input.label === undefined ? undefined : input.label?.trim() || null,
      sheetCode: input.sheetCode === undefined ? undefined : input.sheetCode?.trim() || null,
      discipline: input.discipline,
      revision: input.revision === undefined ? undefined : input.revision?.trim() || null,
    });
    if (updated === 0) throw new NotFoundError("Plan");
    return repo.listPlans(proposalId);
  }

  async function getWorkspace(proposalId: string, orgId: string) {
    const row = await repo.getById(proposalId, orgId);
    if (!row) return null;
    const proposal = repo.toProposal(row);
    const [activeEstimate, events] = await Promise.all([
      repo.getActiveEstimate(proposalId),
      repo.listEvents(proposalId),
    ]);

    if (activeEstimate) {
      const [items, schedule] = await Promise.all([
        repo.getItems(activeEstimate.id),
        repo.getSchedule(activeEstimate.id),
      ]);
      return { proposal, estimate: { ...activeEstimate, items, schedule }, events };
    }
    return { proposal, estimate: null, events };
  }

  async function createEstimateRevision(
    proposalId: string,
    orgId: string,
    userId: string,
    opts: { changeNote?: string; orgTaxLabel?: string; orgTaxPct?: number },
  ) {
    const row = await repo.getById(proposalId, orgId);
    if (!row) throw new NotFoundError("Proposal");

    // Superseding the last revision and opening the next are one transition:
    // held under the proposal's revision locks so two concurrent callers cannot
    // both read the same revision number and both claim to supersede.
    return estimates.withProposalEstimatesLock(proposalId, async (ctx) => {
      const existing = await ctx.proposals.getActiveEstimate(proposalId);
      const revisionNo = existing ? existing.revisionNo + 1 : 1;

      if (revisionNo > 1) {
        if (!opts.changeNote?.trim()) {
          throw new BadRequestError("A change note is required when creating a new revision.");
        }
        // Supersede previous Sent revision (Draft revisions are just replaced)
        await ctx.proposals.supersedePreviousSentEstimate(proposalId);
      }

      const estimate = await ctx.proposals.insertEstimate({
        id: generateId("est"),
        proposalId,
        revisionNo,
        taxLabel: opts.orgTaxLabel ?? "VAT",
        taxPct: opts.orgTaxPct ?? 0,
        changeNote: opts.changeNote,
      });

      await ctx.proposals.logEvent(proposalId, "estimate_drafted", userId, { revisionNo });

      // Update proposal to "Preparing" if it was "New"
      if (row.status === "New") {
        await ctx.proposals.updateProposal(proposalId, orgId, { status: "Preparing" });
      }

      return estimate;
    });
  }

  async function saveEstimateItems(
    estimateId: string,
    proposalId: string,
    orgId: string,
    items: CreateEstimateItemInput[],
  ) {
    return estimates.saveEstimateItems(estimateId, proposalId, orgId, items);
  }

  async function updateEstimateMeta(
    estimateId: string,
    proposalId: string,
    orgId: string,
    patch: { contingencyPct?: number; taxLabel?: string; taxPct?: number },
  ) {
    await estimates.updateEstimateMeta(estimateId, proposalId, orgId, patch);
  }

  return {
    createProposal,
    addPlan,
    updatePlan,
    getWorkspace,
    createEstimateRevision,
    saveEstimateItems,
    updateEstimateMeta,
  };
}

export type ProposalsService = ReturnType<typeof proposalsService>;

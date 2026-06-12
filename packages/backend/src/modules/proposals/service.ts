import type { ProposalsRepository } from "./repository.ts";
import type {
  CreateProposalInput,
  CreateEstimateItemInput,
  CreatePaymentScheduleInput,
} from "./types.ts";
import { generateId } from "../../lib/ids.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";

export function proposalsService(repo: ProposalsRepository) {
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
      createdBy: userId,
    });
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

    const existing = await repo.getActiveEstimate(proposalId);
    const revisionNo = existing ? existing.revisionNo + 1 : 1;

    if (revisionNo > 1) {
      if (!opts.changeNote?.trim()) {
        throw new BadRequestError("A change note is required when creating a new revision.");
      }
      // Supersede previous Sent revision (Draft revisions are just replaced)
      await repo.supersedePreviousSentEstimate(proposalId);
    }

    const estimate = await repo.insertEstimate({
      id: generateId("est"),
      proposalId,
      revisionNo,
      taxLabel: opts.orgTaxLabel ?? "VAT",
      taxPct: opts.orgTaxPct ?? 0,
      changeNote: opts.changeNote,
    });

    await repo.logEvent(proposalId, "estimate_drafted", userId, { revisionNo });

    // Update proposal to "Preparing" if it was "New"
    if (row.status === "New") {
      await repo.updateProposal(proposalId, orgId, { status: "Preparing" });
    }

    return estimate;
  }

  async function saveEstimateItems(
    estimateId: string,
    proposalId: string,
    orgId: string,
    items: CreateEstimateItemInput[],
  ) {
    const proposal = await repo.getById(proposalId, orgId);
    if (!proposal) throw new ForbiddenError("No access to this proposal");

    const estimate = await repo.getEstimate(estimateId);
    if (!estimate || estimate.proposalId !== proposalId) throw new NotFoundError("Estimate");
    if (estimate.status !== "Draft") {
      throw new BadRequestError("Only Draft estimates can be edited. Create a new revision to make changes.");
    }

    const ids = items.map(() => generateId("item"));
    const saved = await repo.replaceItems(estimateId, items, ids);
    await repo.recalcTotals(estimateId, estimate.contingencyPct, estimate.taxPct);
    return saved;
  }

  async function savePaymentSchedule(
    estimateId: string,
    proposalId: string,
    orgId: string,
    schedule: CreatePaymentScheduleInput[],
  ) {
    const proposal = await repo.getById(proposalId, orgId);
    if (!proposal) throw new ForbiddenError("No access to this proposal");

    const estimate = await repo.getEstimate(estimateId);
    if (!estimate || estimate.proposalId !== proposalId) throw new NotFoundError("Estimate");
    if (estimate.status !== "Draft") {
      throw new BadRequestError("Only Draft estimates can be edited.");
    }

    const ids = schedule.map(() => generateId("sched"));
    return repo.replaceSchedule(estimateId, schedule, ids);
  }

  async function updateEstimateMeta(
    estimateId: string,
    proposalId: string,
    orgId: string,
    patch: { contingencyPct?: number; taxLabel?: string; taxPct?: number },
  ) {
    const proposal = await repo.getById(proposalId, orgId);
    if (!proposal) throw new ForbiddenError("No access to this proposal");

    const estimate = await repo.getEstimate(estimateId);
    if (!estimate || estimate.proposalId !== proposalId) throw new NotFoundError("Estimate");
    if (estimate.status !== "Draft") {
      throw new BadRequestError("Only Draft estimates can be edited.");
    }

    await repo.updateEstimateMeta(estimateId, patch);
    const newContingency = patch.contingencyPct ?? estimate.contingencyPct;
    const newTaxPct = patch.taxPct ?? estimate.taxPct;
    await repo.recalcTotals(estimateId, newContingency, newTaxPct);
  }

  return {
    createProposal,
    getWorkspace,
    createEstimateRevision,
    saveEstimateItems,
    savePaymentSchedule,
    updateEstimateMeta,
  };
}

export type ProposalsService = ReturnType<typeof proposalsService>;

// The only way estimate lines are replaced.
//
// An estimate's priced lines, its denormalized totals and its Draft rule are
// one fact. Before this seam they were three separate writes on three separate
// connections: `replaceItems` opened its own transaction, `recalcTotals` ran
// after it on the pool, and the status was read before either. A failure
// between them left an estimate whose total belonged to lines that no longer
// existed, and two concurrent savers could interleave into a set of lines
// neither of them composed.
//
// So: one transaction, opened here, holding the estimate's row lock, inside
// which the status is checked, the lines are replaced and the totals are
// recalculated. `saveItemsInTransaction` is the same work for a caller that
// already holds the lock — the take-off apply path, which locks its session
// first and then this estimate.

import type { Knex } from "knex";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { estimateItemsRepository, type EstimateItemsRepository } from "./estimate-items-repository.ts";
import { estimatesRepository, type EstimatesRepository } from "./estimates-repository.ts";
import { proposalsRepository, type ProposalsRepository } from "./repository.ts";
import type { CreateEstimateItemInput, Estimate, EstimateItem } from "./types.ts";

interface BoundRepositories {
  trx: Knex.Transaction;
  items: EstimateItemsRepository;
  estimates: EstimatesRepository;
  proposals: ProposalsRepository;
}

export interface EstimateWriteContext extends BoundRepositories {
  /** The estimate as committed under the lock this context holds. */
  estimate: Estimate;
}

export interface ProposalEstimatesContext extends BoundRepositories {
  /** Every revision of the proposal, all locked, oldest id first. */
  locked: Estimate[];
}

function bind(trx: Knex.Transaction): BoundRepositories {
  return {
    trx,
    items: estimateItemsRepository(trx),
    estimates: estimatesRepository(trx),
    proposals: proposalsRepository(trx),
  };
}

export function assertDraft(estimate: Estimate, what = "edited"): void {
  if (estimate.status !== "Draft") {
    throw new BadRequestError(
      `Only Draft estimates can be ${what}. Create a new revision to make changes.`,
    );
  }
}

async function lockInTransaction(trx: Knex.Transaction, estimateId: string): Promise<EstimateWriteContext> {
  const bound = bind(trx);
  const estimate = await bound.estimates.lockEstimate(estimateId);
  if (!estimate) throw new NotFoundError("Estimate");
  return { ...bound, estimate };
}

/**
 * Replace an estimate's lines and its totals on a transaction the caller
 * already owns and has already locked the estimate on. Opens no transaction:
 * a failing recalculation must be able to roll the replaced lines back.
 */
export async function saveItemsInTransaction(
  ctx: EstimateWriteContext,
  items: CreateEstimateItemInput[],
): Promise<EstimateItem[]> {
  assertDraft(ctx.estimate);
  const ids = items.map(() => generateId("item"));
  const saved = await ctx.items.replaceItems(ctx.estimate.id, items, ids);
  await ctx.items.recalcTotals(ctx.estimate.id, ctx.estimate.contingencyPct, ctx.estimate.taxPct);
  return saved;
}

export function estimateItemsService(db: Knex) {
  /**
   * Run `callback` in one transaction holding the estimate's row lock. Every
   * writer that replaces items or moves the estimate's meta or status enters
   * through here, which is what makes "one writer at a time" true rather than
   * hoped for.
   */
  async function withEstimateLock<T>(
    estimateId: string,
    callback: (ctx: EstimateWriteContext) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (trx) => callback(await lockInTransaction(trx, estimateId)));
  }

  // For the writers that act on a proposal's revisions as a set — opening the
  // next revision while superseding the last — where there is no single
  // estimate id to lock yet.
  async function withProposalEstimatesLock<T>(
    proposalId: string,
    callback: (ctx: ProposalEstimatesContext) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (trx) => {
      const bound = bind(trx);
      const locked = await bound.estimates.lockProposalEstimates(proposalId);
      return callback({ ...bound, locked });
    });
  }

  /**
   * The guard every authenticated estimate writer shares: proposal ownership,
   * then the estimate's row lock, then the Draft rule — all in one transaction,
   * so what the rule was checked against is what the write lands on.
   */
  async function withOwnedDraftEstimate<T>(
    estimateId: string,
    proposalId: string,
    orgId: string,
    callback: (ctx: EstimateWriteContext) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (trx) => {
      // Ownership is checked before the lock is taken, so a caller with no
      // access to the proposal still gets 403 rather than 404 on an estimate
      // whose existence it was never entitled to learn.
      const proposal = await proposalsRepository(trx).getById(proposalId, orgId);
      if (!proposal) throw new ForbiddenError("No access to this proposal");
      const ctx = await lockInTransaction(trx, estimateId);
      if (ctx.estimate.proposalId !== proposalId) throw new NotFoundError("Estimate");
      assertDraft(ctx.estimate);
      return callback(ctx);
    });
  }

  async function saveEstimateItems(
    estimateId: string,
    proposalId: string,
    orgId: string,
    items: CreateEstimateItemInput[],
  ): Promise<EstimateItem[]> {
    return withOwnedDraftEstimate(estimateId, proposalId, orgId, (ctx) => saveItemsInTransaction(ctx, items));
  }

  async function updateEstimateMeta(
    estimateId: string,
    proposalId: string,
    orgId: string,
    patch: { contingencyPct?: number; taxLabel?: string; taxPct?: number },
  ): Promise<void> {
    await withOwnedDraftEstimate(estimateId, proposalId, orgId, async (ctx) => {
      await ctx.estimates.updateEstimateMeta(estimateId, patch);
      await ctx.items.recalcTotals(
        estimateId,
        patch.contingencyPct ?? ctx.estimate.contingencyPct,
        patch.taxPct ?? ctx.estimate.taxPct,
      );
    });
  }

  return {
    withEstimateLock,
    withProposalEstimatesLock,
    withOwnedDraftEstimate,
    saveEstimateItems,
    updateEstimateMeta,
  };
}

export type EstimateItemsService = ReturnType<typeof estimateItemsService>;

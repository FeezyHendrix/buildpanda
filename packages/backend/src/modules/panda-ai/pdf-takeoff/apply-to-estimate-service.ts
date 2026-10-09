// Take-off → estimate, as one transaction over two domains.
//
// Both modes hold the take-off session's lock and then the target estimate's,
// in that order and never the reverse: reading both sides under the same locks
// is what makes the preview's tokens describe a single coherent moment, and a
// fixed order is what stops the editor and the estimate deadlocking.
//
// Preview writes nothing. Apply re-derives the preview under those same locks
// and refuses unless the client's tokens still match it, so the lines written
// are the lines somebody read. The replacement and the totals share this
// transaction, so a failing recalculation takes the replacement down with it
// rather than leaving an estimate totalling items that no longer exist.
//
// The cross-domain wiring lives here, at the composition root. Neither domain's
// SQL crosses into the other: the take-off is read through preconRepository and
// the estimate through the proposals repositories, both bound to this
// transaction.

import type { Knex } from "knex";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../../lib/errors.ts";
import { estimateItemsRepository } from "../../proposals/estimate-items-repository.ts";
import { assertDraft, saveItemsInTransaction } from "../../proposals/estimate-items-service.ts";
import { estimatesRepository } from "../../proposals/estimates-repository.ts";
import { proposalsRepository } from "../../proposals/repository.ts";
import { assertNoDrift, assertPinned, buildApplyPreview, itemsToWrite } from "./apply-to-estimate.ts";
import { createEditorUnitOfWork } from "./editor-unit-of-work.ts";
import { preconRepository } from "./repository.ts";
import { preconService } from "./service.ts";
import type { ApplyPreview, ApplyResult, ApplyToEstimateBody } from "./types.ts";

export function applyToEstimateService(db: Knex) {
  const withSessionWrite = createEditorUnitOfWork(db);
  const sessions = preconService(preconRepository(db));

  async function run(
    sessionId: string,
    orgId: string,
    body: ApplyToEstimateBody,
  ): Promise<ApplyPreview | ApplyResult> {
    const session = await sessions.assertSessionOrg(sessionId, orgId);
    if (!session.proposalId) throw new BadRequestError("This take-off is not linked to a proposal");
    const proposalId = session.proposalId;
    if (body.mode === "apply") assertPinned(body);

    return withSessionWrite(session.id, async (ctx): Promise<ApplyPreview | ApplyResult> => {
      const proposals = proposalsRepository(ctx.trx);
      const estimates = estimatesRepository(ctx.trx);
      const items = estimateItemsRepository(ctx.trx);

      if (!(await proposals.getById(proposalId, orgId))) {
        throw new ForbiddenError("No access to this proposal");
      }
      const estimate = await estimates.lockEstimate(body.estimateId);
      if (!estimate || estimate.proposalId !== proposalId) throw new NotFoundError("Estimate");

      const [snapshot, existing] = await Promise.all([
        preconService(preconRepository(ctx.trx)).getSnapshot(session.id),
        items.getItems(estimate.id),
      ]);
      const preview = buildApplyPreview({
        sessionId: session.id,
        bills: snapshot.bills,
        rows: snapshot.rows,
        settings: snapshot.settings,
        estimate,
        existing,
      });

      if (body.mode === "preview") return preview;

      assertDraft(estimate);
      assertNoDrift(preview, body);
      const written = await saveItemsInTransaction(
        { trx: ctx.trx, estimate, items, estimates, proposals },
        itemsToWrite(preview),
      );
      return {
        ...preview,
        items: preview.items.filter((i) => i.change !== "removed"),
        applied: true,
        written: written.length,
      };
    });
  }

  return { run };
}

export type ApplyToEstimateService = ReturnType<typeof applyToEstimateService>;

import { assertTransaction, type EstimateDb } from "./estimate-db.ts";
import type { Estimate, EstimateRow, EstimateStatus, ProposalRow } from "./types.ts";

function toEstimate(row: EstimateRow): Estimate {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    revisionNo: row.revision_no,
    revisionLabel: `Rev ${row.revision_no}`,
    status: row.status,
    contingencyPct: Number(row.contingency_pct),
    taxLabel: row.tax_label ?? "VAT",
    taxPct: Number(row.tax_pct),
    changeNote: row.change_note,
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    shareToken: row.share_token,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    acceptedByName: row.accepted_by_name,
    retentionPct: row.retention_pct === null || row.retention_pct === undefined ? null : Number(row.retention_pct),
    retentionMode: row.retention_mode ?? null,
    advancePct: row.advance_pct === null || row.advance_pct === undefined ? null : Number(row.advance_pct),
    whtPct: row.wht_pct === null || row.wht_pct === undefined ? null : Number(row.wht_pct),
    paymentTermsDays: row.payment_terms_days ?? null,
    defectsLiabilityDays: row.defects_liability_days ?? null,
    clientVisibleDetail: row.client_visible_detail ?? "lines",
    acceptedIp: row.accepted_ip ?? null,
    acceptedUserAgent: row.accepted_user_agent ?? null,
    acceptedPdfHash: row.accepted_pdf_hash ?? null,
    snapshotFileId: row.snapshot_file_id ?? null,
    responseMessage: row.response_message ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type EstimatesRepository = ReturnType<typeof estimatesRepository>;

// The estimate revisions hanging off a proposal: reading them, opening a new
// one, superseding the last, the share link, and the expiry sweep.
export function estimatesRepository(db: EstimateDb) {
  // Lock order is session → estimate, never the inverse: the apply path already
  // holds the take-off session when it gets here, so a caller that took these
  // the other way round would close the cycle and deadlock.
  async function lockEstimate(estimateId: string): Promise<Estimate | null> {
    const trx = assertTransaction(db, "lockEstimate");
    const row = await trx<EstimateRow>("estimates").where({ id: estimateId }).forUpdate().first();
    return row ? toEstimate(row) : null;
  }

  // Stable id order, and the whole set rather than one row: two concurrent
  // "new revision" calls would otherwise both read "no Sent revision here".
  async function lockProposalEstimates(proposalId: string): Promise<Estimate[]> {
    const trx = assertTransaction(db, "lockProposalEstimates");
    const rows = await trx<EstimateRow>("estimates")
      .where({ proposal_id: proposalId })
      .orderBy("id", "asc")
      .forUpdate();
    return rows.map(toEstimate);
  }

  async function getActiveEstimate(proposalId: string): Promise<Estimate | null> {
    const row = await db<EstimateRow>("estimates")
      .where({ proposal_id: proposalId })
      .whereNotIn("status", ["Superseded"])
      .orderBy("revision_no", "desc")
      .first();
    return row ? toEstimate(row) : null;
  }

  async function getEstimate(estimateId: string): Promise<Estimate | null> {
    const row = await db<EstimateRow>("estimates").where({ id: estimateId }).first();
    return row ? toEstimate(row) : null;
  }

  async function listEstimateRevisions(proposalId: string): Promise<Estimate[]> {
    const rows = await db<EstimateRow>("estimates")
      .where({ proposal_id: proposalId })
      .orderBy("revision_no", "asc");
    return rows.map(toEstimate);
  }

  async function insertEstimate(data: {
    id: string;
    proposalId: string;
    revisionNo: number;
    taxLabel: string;
    taxPct: number;
    changeNote?: string;
  }): Promise<Estimate> {
    const rows = await db<EstimateRow>("estimates")
      .insert({
        id: data.id,
        proposal_id: data.proposalId,
        revision_no: data.revisionNo,
        status: "Draft",
        contingency_pct: 0,
        tax_label: data.taxLabel,
        tax_pct: data.taxPct,
        change_note: data.changeNote ?? null,
        subtotal: 0,
        tax_amount: 0,
        total: 0,
      })
      .returning("*");
    return toEstimate(rows[0]!);
  }

  async function supersedePreviousSentEstimate(proposalId: string): Promise<void> {
    await db<EstimateRow>("estimates")
      .where({ proposal_id: proposalId, status: "Sent" })
      .update({ status: "Superseded", updated_at: new Date().toISOString() });
  }

  async function updateEstimateMeta(
    estimateId: string,
    patch: Partial<{ contingencyPct: number; taxLabel: string; taxPct: number; status: EstimateStatus; sentAt: string; acceptedAt: string; acceptedByName: string }>,
  ): Promise<void> {
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.contingencyPct !== undefined) dbPatch["contingency_pct"] = patch.contingencyPct;
    if (patch.taxLabel !== undefined) dbPatch["tax_label"] = patch.taxLabel;
    if (patch.taxPct !== undefined) dbPatch["tax_pct"] = patch.taxPct;
    if (patch.status !== undefined) dbPatch["status"] = patch.status;
    if (patch.sentAt !== undefined) dbPatch["sent_at"] = patch.sentAt;
    if (patch.acceptedAt !== undefined) dbPatch["accepted_at"] = patch.acceptedAt;
    if (patch.acceptedByName !== undefined) dbPatch["accepted_by_name"] = patch.acceptedByName;
    await db("estimates").where({ id: estimateId }).update(dbPatch);
  }

  // --- Share tokens ---

  async function setShareToken(
    estimateId: string,
    token: string,
    expiresAt: string,
  ): Promise<void> {
    await db("estimates")
      .where({ id: estimateId })
      .update({ share_token: token, share_token_expires_at: expiresAt, updated_at: new Date().toISOString() });
  }

  async function getByShareToken(
    token: string,
  ): Promise<{ proposal: ProposalRow; estimate: EstimateRow } | null> {
    const estimate = await db<EstimateRow>("estimates")
      .where({ share_token: token })
      .first();
    if (!estimate) return null;
    const proposal = await db<ProposalRow>("proposals")
      .where({ id: estimate.proposal_id })
      .first();
    if (!proposal) return null;
    return { proposal, estimate };
  }

  // --- Expiry sweep ---

  // The sweep moves the same statuses an interactive writer does, so it takes
  // the same locks. `skipLocked` rather than waiting: an estimate somebody is
  // actively sending is simply left for the next tick instead of blocking the
  // whole sweep behind it.
  async function expireOverdueEstimates(
    now: string,
  ): Promise<Array<{ proposalId: string; estimateId: string }>> {
    const trx = assertTransaction(db, "expireOverdueEstimates");
    const rows = await trx<EstimateRow>("estimates")
      .join("proposals", "proposals.id", "estimates.proposal_id")
      .whereIn("estimates.status", ["Sent", "Draft"])
      .whereNotNull("proposals.valid_until")
      .where("proposals.valid_until", "<", now)
      .orderBy("estimates.id", "asc")
      .forUpdate("estimates")
      .skipLocked()
      .select("estimates.id as estimate_id", "proposals.id as proposal_id");

    if (rows.length === 0) return [];

    const estimateIds = rows.map((r) => (r as unknown as { estimate_id: string }).estimate_id);
    await trx("estimates")
      .whereIn("id", estimateIds)
      .update({ status: "Expired", updated_at: now });

    const proposalIds = [...new Set(rows.map((r) => (r as unknown as { proposal_id: string }).proposal_id))];
    await trx("proposals")
      .whereIn("id", proposalIds)
      .whereNotIn("status", ["Accepted", "Converted", "Lost"])
      .update({ status: "Expired", updated_at: now });

    return rows.map((r) => ({
      proposalId: (r as unknown as { proposal_id: string }).proposal_id,
      estimateId: (r as unknown as { estimate_id: string }).estimate_id,
    }));
  }

  async function getProposalsExpiringWithinDays(
    days: number,
    now: string,
  ): Promise<Array<{ proposal: ProposalRow; orgEmail: string | null; orgName: string }>> {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffStr = cutoff.toISOString();

    const rows = await db<ProposalRow>("proposals as p")
      .join("organization as o", "o.id", "p.org_id")
      .whereIn("p.status", ["Sent", "Preparing"])
      .whereNotNull("p.valid_until")
      .where("p.valid_until", ">", now)
      .where("p.valid_until", "<=", cutoffStr)
      .whereNotExists(
        db("proposal_events")
          .where("proposal_id", db.raw("p.id"))
          .where("type", "expiry_nudge_sent"),
      )
      .select("p.*", "o.contact_email as org_email", "o.name as org_name");

    return rows.map((r) => ({
      proposal: r,
      orgEmail: (r as unknown as { org_email: string | null }).org_email,
      orgName: (r as unknown as { org_name: string }).org_name,
    }));
  }

  return {
    lockEstimate,
    lockProposalEstimates,
    getActiveEstimate,
    getEstimate,
    listEstimateRevisions,
    insertEstimate,
    supersedePreviousSentEstimate,
    updateEstimateMeta,
    setShareToken,
    getByShareToken,
    expireOverdueEstimates,
    getProposalsExpiringWithinDays,
    toEstimate,
  };
}

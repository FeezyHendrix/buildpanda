import type { Knex } from "knex";
import type {
  ClientResponse,
  EstimateRow,
  PackSection,
  PackSectionKind,
  PackOrigin,
  PackSectionRow,
  UpdateEstimateTermsInput,
} from "./types.ts";

// The money terms, the acceptance evidence and the pack prose all hang off the
// proposal/estimate pair, but they arrived after the core repository had grown
// past its ceiling — so they live here, on the same tables, behind one factory.

function toPackSection(row: PackSectionRow): PackSection {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    estimateId: row.estimate_id,
    kind: row.kind,
    bodyHtml: row.body_html,
    sort: row.sort,
    origin: row.origin,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export interface ResponseRecord {
  action: ClientResponse;
  name: string;
  message: string | null;
  ip: string | null;
  userAgent: string | null;
  at: string;
}

export function proposalTermsRepository(db: Knex) {
  return {
    updateTerms: (estimateId: string, patch: Omit<UpdateEstimateTermsInput, "validUntil">) => {
      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.retentionPct !== undefined) dbPatch["retention_pct"] = patch.retentionPct;
      if (patch.retentionMode !== undefined) dbPatch["retention_mode"] = patch.retentionMode;
      if (patch.advancePct !== undefined) dbPatch["advance_pct"] = patch.advancePct;
      if (patch.whtPct !== undefined) dbPatch["wht_pct"] = patch.whtPct;
      if (patch.paymentTermsDays !== undefined) dbPatch["payment_terms_days"] = patch.paymentTermsDays;
      if (patch.defectsLiabilityDays !== undefined) dbPatch["defects_liability_days"] = patch.defectsLiabilityDays;
      if (patch.clientVisibleDetail !== undefined) dbPatch["client_visible_detail"] = patch.clientVisibleDetail;
      return db<EstimateRow>("estimates").where({ id: estimateId }).update(dbPatch);
    },

    // Send stores what the client will see: the snapshot file and its hash.
    setSnapshot: (estimateId: string, snapshotFileId: string, pdfHash: string) =>
      db<EstimateRow>("estimates")
        .where({ id: estimateId })
        .update({ snapshot_file_id: snapshotFileId, accepted_pdf_hash: pdfHash, updated_at: new Date().toISOString() }),

    // Every client response is evidence, not just acceptance: who, when, from
    // where, and what they said.
    recordResponse: (estimateId: string, record: ResponseRecord) =>
      db<EstimateRow>("estimates")
        .where({ id: estimateId })
        .update({
          accepted_by_name: record.name,
          accepted_ip: record.ip,
          accepted_user_agent: record.userAgent,
          response_message: record.message,
          ...(record.action === "accept" ? { accepted_at: record.at } : {}),
          updated_at: record.at,
        }),

    countEvents: async (proposalId: string, type: string): Promise<number> => {
      const row = await db("proposal_events")
        .where({ proposal_id: proposalId, type })
        .count<{ count: string }[]>("id as count")
        .first();
      return Number(row?.count ?? 0);
    },

    // pack sections
    listPackSections: async (proposalId: string): Promise<PackSection[]> => {
      const rows = await db<PackSectionRow>("proposal_pack_sections")
        .where({ proposal_id: proposalId })
        .orderBy("sort", "asc");
      return rows.map(toPackSection);
    },

    upsertPackSection: async (row: {
      id: string;
      proposalId: string;
      estimateId: string | null;
      kind: PackSectionKind;
      bodyHtml: string;
      sort: number;
      origin: PackOrigin;
      updatedBy: string | null;
    }): Promise<PackSection> => {
      const now = new Date().toISOString();
      const [saved] = await db<PackSectionRow>("proposal_pack_sections")
        .insert({
          id: row.id,
          proposal_id: row.proposalId,
          estimate_id: row.estimateId,
          kind: row.kind,
          body_html: row.bodyHtml,
          sort: row.sort,
          origin: row.origin,
          updated_by: row.updatedBy,
          updated_at: now,
        })
        .onConflict(["proposal_id", "kind"])
        .merge({
          body_html: row.bodyHtml,
          origin: row.origin,
          updated_by: row.updatedBy,
          updated_at: now,
          estimate_id: row.estimateId,
        })
        .returning("*");
      return toPackSection(saved!);
    },

    deletePackSection: (proposalId: string, kind: PackSectionKind) =>
      db("proposal_pack_sections").where({ proposal_id: proposalId, kind }).delete(),
  };
}

export type ProposalTermsRepository = ReturnType<typeof proposalTermsRepository>;

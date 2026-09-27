// Composition facade for the proposals data access. The proposal record and
// its BOQ live here; estimates, their priced lines, the activity trail and the
// plans are domain-scoped siblings spread into the same flat shape every
// caller already depends on.
import type { Knex } from "knex";
import { generateId } from "../../lib/ids.ts";
import { plansRepository } from "./plans-repository.ts";
import { estimateItemsRepository } from "./estimate-items-repository.ts";
import { estimatesRepository } from "./estimates-repository.ts";
import { proposalCommentsRepository } from "./proposal-comments-repository.ts";
import type {
  Proposal,
  ProposalRow,
  ProposalStatus,
  EstimateRow,
  JobProfile,
  ProposalBoqItem,
  ProposalBoqItemRow,
  CreateBoqItemInput,
} from "./types.ts";

export { estimateItemsRepository } from "./estimate-items-repository.ts";
export { estimatesRepository } from "./estimates-repository.ts";
export { proposalCommentsRepository } from "./proposal-comments-repository.ts";
export type { EstimateItemsRepository } from "./estimate-items-repository.ts";
export type { EstimatesRepository } from "./estimates-repository.ts";
export type { Comment, ProposalCommentsRepository } from "./proposal-comments-repository.ts";

function toProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    orgId: row.org_id,
    leadId: row.lead_id,
    projectId: row.project_id,
    number: row.number,
    numberLabel: `BP-${String(row.number).padStart(4, "0")}`,
    title: row.title,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    location: row.location,
    brief: row.brief,
    status: row.status,
    currency: row.currency,
    validUntil: row.valid_until,
    jobProfile: row.job_profile ?? "full_contract",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function proposalsRepository(db: Knex) {
  // --- Proposals ---

  async function nextNumber(orgId: string, trx: Knex.Transaction): Promise<number> {
    const row = await trx<ProposalRow>("proposals")
      .where({ org_id: orgId })
      .max<{ max: number | null }[]>("number as max")
      .first();
    return (row?.max ?? 0) + 1;
  }

  async function insertProposal(data: {
    id: string;
    orgId: string;
    number: number;
    title: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    location?: string;
    brief?: string;
    currency: string;
    validUntil?: string;
    leadId?: string;
    jobProfile?: JobProfile;
    createdBy: string;
  }): Promise<Proposal> {
    return db.transaction(async (trx) => {
      const number = data.number;
      const rows = await trx<ProposalRow>("proposals")
        .insert({
          id: data.id,
          org_id: data.orgId,
          number,
          title: data.title,
          client_name: data.clientName,
          client_email: data.clientEmail ?? null,
          client_phone: data.clientPhone ?? null,
          location: data.location ?? null,
          brief: data.brief ?? null,
          currency: data.currency,
          valid_until: data.validUntil ?? null,
          lead_id: data.leadId ?? null,
          job_profile: data.jobProfile ?? "full_contract",
          created_by: data.createdBy,
        })
        .returning("*");
      await trx("proposal_events").insert({
        id: `evt_${Date.now()}`,
        proposal_id: data.id,
        type: "created",
        actor: data.createdBy,
        metadata: null,
      });
      return toProposal(rows[0]!);
    });
  }

  async function allocateNumber(orgId: string): Promise<number> {
    return db.transaction((trx) => nextNumber(orgId, trx));
  }

  async function listByOrg(
    orgId: string,
    params: { status?: string; limit: number; offset: number },
  ) {
    const base = db<ProposalRow>("proposals as p")
      .where("p.org_id", orgId)
      .leftJoin(
        db<EstimateRow>("estimates as e")
          .whereNotIn("e.status", ["Superseded"])
          .select(
            "e.proposal_id",
            db.raw("MAX(e.revision_no) as latest_rev"),
            db.raw("MAX(e.total) as latest_total"),
          )
          .groupBy("e.proposal_id")
          .as("est"),
        "est.proposal_id",
        "p.id",
      );

    if (params.status) base.where("p.status", params.status);

    const totalRow = await base
      .clone()
      .clearSelect()
      .count<{ count: string }[]>("p.id as count")
      .first();

    const rows = await base
      .clone()
      .select(
        "p.id",
        "p.number",
        "p.title",
        "p.client_name",
        "p.location",
        "p.status",
        "p.currency",
        "p.valid_until",
        "p.created_at",
        db.raw("est.latest_total as estimate_total"),
      )
      .orderBy("p.created_at", "desc")
      .limit(params.limit)
      .offset(params.offset);

    return {
      total: Number(totalRow?.count ?? 0),
      rows: rows.map((r) => ({
        id: r.id as string,
        number: r.number as number,
        numberLabel: `BP-${String(r.number).padStart(4, "0")}`,
        title: r.title as string,
        clientName: r.client_name as string,
        location: r.location as string | null,
        status: r.status as ProposalStatus,
        currency: r.currency as string,
        validUntil: (r.valid_until as string | null) ?? null,
        createdAt: r.created_at as string,
        estimateTotal: r.estimate_total != null ? Number(r.estimate_total) : null,
      })),
    };
  }

  async function getById(id: string, orgId: string): Promise<ProposalRow | null> {
    const row = await db<ProposalRow>("proposals").where({ id, org_id: orgId }).first();
    return row ?? null;
  }

  async function updateProposal(id: string, orgId: string, patch: Partial<{
    title: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    location: string | null;
    brief: string | null;
    status: ProposalStatus;
    currency: string;
    validUntil: string | null;
    jobProfile: JobProfile;
  }>): Promise<ProposalRow | null> {
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) dbPatch["title"] = patch.title;
    if (patch.clientName !== undefined) dbPatch["client_name"] = patch.clientName;
    if (patch.clientEmail !== undefined) dbPatch["client_email"] = patch.clientEmail;
    if (patch.clientPhone !== undefined) dbPatch["client_phone"] = patch.clientPhone;
    if (patch.location !== undefined) dbPatch["location"] = patch.location;
    if (patch.brief !== undefined) dbPatch["brief"] = patch.brief;
    if (patch.status !== undefined) dbPatch["status"] = patch.status;
    if (patch.currency !== undefined) dbPatch["currency"] = patch.currency;
    if (patch.validUntil !== undefined) dbPatch["valid_until"] = patch.validUntil;
    if (patch.jobProfile !== undefined) dbPatch["job_profile"] = patch.jobProfile;
    await db("proposals").where({ id, org_id: orgId }).update(dbPatch);
    return getById(id, orgId);
  }

  async function deleteProposal(id: string, orgId: string): Promise<void> {
    await db("proposals").where({ id, org_id: orgId }).del();
  }

  // --- Proposal BOQ ---

  async function listBoqItems(proposalId: string): Promise<ProposalBoqItem[]> {
    const rows = await db<ProposalBoqItemRow>("proposal_boq_items")
      .where({ proposal_id: proposalId })
      .orderBy("sort", "asc");
    return rows.map((r) => ({
      id: r.id,
      proposalId: r.proposal_id,
      groupLabel: r.group_label,
      description: r.description,
      descriptionHtml: r.description_html,
      qty: Number(r.qty),
      unit: r.unit,
      sort: r.sort,
    }));
  }

  async function replaceBoqItems(
    proposalId: string,
    items: CreateBoqItemInput[],
  ): Promise<void> {
    await db.transaction(async (trx) => {
      await trx("proposal_boq_items").where({ proposal_id: proposalId }).delete();
      if (items.length === 0) return;
      const rows = items.map((item, idx) => ({
        id: generateId("boq"),
        proposal_id: proposalId,
        group_label: item.groupLabel,
        description: item.description,
        description_html: item.descriptionHtml ?? null,
        qty: item.qty,
        unit: item.unit,
        sort: item.sort ?? idx,
      }));
      await trx("proposal_boq_items").insert(rows);
    });
  }

  return {
    allocateNumber,
    insertProposal,
    listByOrg,
    getById,
    updateProposal,
    deleteProposal,
    ...proposalCommentsRepository(db),
    ...estimatesRepository(db),
    ...estimateItemsRepository(db),
    toProposal,
    ...plansRepository(db),
    listBoqItems,
    replaceBoqItems,
  };
}

export type ProposalsRepository = ReturnType<typeof proposalsRepository>;

import type { Knex } from "knex";
import type {
  Proposal,
  ProposalRow,
  ProposalStatus,
  Estimate,
  EstimateRow,
  EstimateStatus,
  EstimateItem,
  EstimateItemRow,
  PaymentScheduleItem,
  PaymentScheduleRow,
  ProposalEvent,
  ProposalEventRow,
  CreateEstimateItemInput,
  CreatePaymentScheduleInput,
} from "./types.ts";

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
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEstimateItem(row: EstimateItemRow): EstimateItem {
  return {
    id: row.id,
    estimateId: row.estimate_id,
    groupLabel: row.group_label,
    description: row.description,
    qty: Number(row.qty),
    unit: row.unit,
    unitRate: Number(row.unit_rate),
    total: Number(row.total),
    boqItemId: row.boq_item_id,
    sort: row.sort,
  };
}

function toScheduleItem(row: PaymentScheduleRow): PaymentScheduleItem {
  return {
    id: row.id,
    estimateId: row.estimate_id,
    label: row.label,
    percent: Number(row.percent),
    description: row.description,
    sort: row.sort,
  };
}

function toEvent(row: ProposalEventRow): ProposalEvent {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    type: row.type,
    actor: row.actor,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

// Calculate denormalized estimate totals from items
function calcTotals(
  items: Pick<EstimateItem, "qty" | "unitRate">[],
  contingencyPct: number,
  taxPct: number,
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitRate, 0);
  const contingencyAmount = subtotal * (contingencyPct / 100);
  const taxableBase = subtotal + contingencyAmount;
  const taxAmount = taxableBase * (taxPct / 100);
  const total = taxableBase + taxAmount;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
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
    await db("proposals").where({ id, org_id: orgId }).update(dbPatch);
    return getById(id, orgId);
  }

  async function deleteProposal(id: string, orgId: string): Promise<void> {
    await db("proposals").where({ id, org_id: orgId }).del();
  }

  // --- Events ---

  async function logEvent(
    proposalId: string,
    type: string,
    actor: string | null,
    metadata?: unknown,
  ): Promise<void> {
    await db("proposal_events").insert({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      proposal_id: proposalId,
      type,
      actor,
      metadata: metadata ?? null,
    });
  }

  async function listEvents(proposalId: string): Promise<ProposalEvent[]> {
    const rows = await db<ProposalEventRow>("proposal_events")
      .where({ proposal_id: proposalId })
      .orderBy("created_at", "desc")
      .limit(50);
    return rows.map(toEvent);
  }

  // --- Estimates ---

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

  async function recalcTotals(estimateId: string, contingencyPct: number, taxPct: number): Promise<void> {
    const items = await db<EstimateItemRow>("estimate_items")
      .where({ estimate_id: estimateId })
      .select("qty", "unit_rate");
    const { subtotal, taxAmount, total } = calcTotals(
      items.map((i) => ({ qty: Number(i.qty), unitRate: Number(i.unit_rate) })),
      contingencyPct,
      taxPct,
    );
    await db("estimates").where({ id: estimateId }).update({ subtotal, tax_amount: taxAmount, total });
  }

  // --- Items ---

  async function getItems(estimateId: string): Promise<EstimateItem[]> {
    const rows = await db<EstimateItemRow>("estimate_items")
      .where({ estimate_id: estimateId })
      .orderBy("sort", "asc");
    return rows.map(toEstimateItem);
  }

  async function replaceItems(estimateId: string, items: CreateEstimateItemInput[], ids: string[]): Promise<EstimateItem[]> {
    return db.transaction(async (trx) => {
      await trx("estimate_items").where({ estimate_id: estimateId }).del();
      if (items.length > 0) {
        await trx("estimate_items").insert(
          items.map((item, i) => ({
            id: ids[i],
            estimate_id: estimateId,
            group_label: item.groupLabel,
            description: item.description,
            qty: item.qty,
            unit: item.unit,
            unit_rate: item.unitRate,
            total: Math.round(item.qty * item.unitRate * 100) / 100,
            boq_item_id: item.boqItemId ?? null,
            sort: item.sort ?? i,
          })),
        );
      }
      const rows = await trx<EstimateItemRow>("estimate_items")
        .where({ estimate_id: estimateId })
        .orderBy("sort", "asc");
      return rows.map(toEstimateItem);
    });
  }

  // --- Payment schedule ---

  async function getSchedule(estimateId: string): Promise<PaymentScheduleItem[]> {
    const rows = await db<PaymentScheduleRow>("estimate_payment_schedule")
      .where({ estimate_id: estimateId })
      .orderBy("sort", "asc");
    return rows.map(toScheduleItem);
  }

  async function replaceSchedule(
    estimateId: string,
    items: CreatePaymentScheduleInput[],
    ids: string[],
  ): Promise<PaymentScheduleItem[]> {
    return db.transaction(async (trx) => {
      await trx("estimate_payment_schedule").where({ estimate_id: estimateId }).del();
      if (items.length > 0) {
        await trx("estimate_payment_schedule").insert(
          items.map((item, i) => ({
            id: ids[i],
            estimate_id: estimateId,
            label: item.label,
            percent: item.percent,
            description: item.description ?? null,
            sort: item.sort ?? i,
          })),
        );
      }
      const rows = await trx<PaymentScheduleRow>("estimate_payment_schedule")
        .where({ estimate_id: estimateId })
        .orderBy("sort", "asc");
      return rows.map(toScheduleItem);
    });
  }

  return {
    allocateNumber,
    insertProposal,
    listByOrg,
    getById,
    updateProposal,
    deleteProposal,
    logEvent,
    listEvents,
    getActiveEstimate,
    getEstimate,
    listEstimateRevisions,
    insertEstimate,
    supersedePreviousSentEstimate,
    updateEstimateMeta,
    recalcTotals,
    getItems,
    replaceItems,
    getSchedule,
    replaceSchedule,
    toProposal,
  };
}

export type ProposalsRepository = ReturnType<typeof proposalsRepository>;

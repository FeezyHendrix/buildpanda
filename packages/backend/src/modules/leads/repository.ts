import type { Knex } from "knex";
import type { Lead, LeadRow, LeadStatus, CreateLeadInput } from "./types.ts";

export interface LeadListParams {
  status?: string;
  limit: number;
  offset: number;
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    location: row.location,
    projectType: row.project_type,
    message: row.message,
    source: row.source,
    status: row.status,
    assignedTo: row.assigned_to,
    notes: row.notes,
    adoptedBy: row.adopted_by,
    adoptedAt: row.adopted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function leadsRepository(db: Knex) {
  async function insert(data: CreateLeadInput & { id: string }): Promise<Lead> {
    const rows = await db<LeadRow>("leads")
      .insert({
        id: data.id,
        org_id: data.orgId ?? null,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        location: data.location ?? null,
        project_type: data.projectType ?? null,
        message: data.message ?? null,
        source: data.source ?? "website",
      })
      .returning("*");
    return toLead(rows[0]!);
  }

  async function listByOrg(orgId: string, params: LeadListParams) {
    const base = db<LeadRow>("leads").where({ org_id: orgId });
    if (params.status) base.where({ status: params.status });
    const totalRow = await base.clone().count<{ count: string }[]>("id as count").first();
    const rows = await base
      .clone()
      .orderBy("created_at", "desc")
      .limit(params.limit)
      .offset(params.offset);
    return { total: Number(totalRow?.count ?? 0), rows: rows.map(toLead) };
  }

  async function listPlatform(params: LeadListParams) {
    const base = db<LeadRow>("leads").whereNull("org_id");
    if (params.status) base.where({ status: params.status });
    const totalRow = await base.clone().count<{ count: string }[]>("id as count").first();
    const rows = await base
      .clone()
      .orderBy("created_at", "desc")
      .limit(params.limit)
      .offset(params.offset);
    return { total: Number(totalRow?.count ?? 0), rows: rows.map(toLead) };
  }

  async function getById(id: string): Promise<Lead | null> {
    const row = await db<LeadRow>("leads").where({ id }).first();
    return row ? toLead(row) : null;
  }

  async function updateNotes(id: string, notes: string): Promise<Lead | null> {
    await db<LeadRow>("leads")
      .where({ id })
      .update({ notes, updated_at: db.fn.now() as unknown as string });
    return getById(id);
  }

  async function updateStatus(id: string, status: LeadStatus): Promise<Lead | null> {
    await db<LeadRow>("leads")
      .where({ id })
      .update({ status, updated_at: db.fn.now() as unknown as string });
    return getById(id);
  }

  async function assign(id: string, orgId: string, adoptedBy: string): Promise<Lead | null> {
    await db<LeadRow>("leads").where({ id }).update({
      org_id: orgId,
      adopted_by: adoptedBy,
      adopted_at: db.fn.now() as unknown as string,
      updated_at: db.fn.now() as unknown as string,
    });
    return getById(id);
  }

  async function countUnassigned(): Promise<number> {
    const row = await db<LeadRow>("leads")
      .whereNull("org_id")
      .count<{ count: string }[]>("id as count")
      .first();
    return Number(row?.count ?? 0);
  }

  return {
    insert,
    listByOrg,
    listPlatform,
    getById,
    updateNotes,
    updateStatus,
    assign,
    countUnassigned,
  };
}

export type LeadsRepository = ReturnType<typeof leadsRepository>;

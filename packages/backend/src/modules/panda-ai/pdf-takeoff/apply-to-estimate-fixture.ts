// A take-off linked to a proposal with a Draft estimate: the shape the apply
// path actually runs against.
//
// Built on the editor's own fixture so the session, bill and sheet are the ones
// every other persistence suite uses, then given the proposal and estimate the
// editor fixture has no reason to carry. Rows are inserted directly here rather
// than drawn through the measuring service: these suites are about drift and
// transactions, and a fixed qty makes the assertions about the apply, not about
// the geometry engine.

import type { Knex } from "knex";
import { dropEditorFixture, seedEditorFixture, type EditorFixture } from "./editor-db-fixture.ts";
import type { RowStatus, RowType } from "./row-types.ts";

export interface ApplyFixture extends EditorFixture {
  proposalId: string;
  estimateId: string;
}

export interface SeedRow {
  id: string;
  description: string;
  qty: number;
  unit?: string;
  rate?: number;
  status?: RowStatus;
  rowType?: RowType;
  elementGroup?: string | null;
  sort?: number;
}

export async function seedApplyFixture(db: Knex, label: string): Promise<ApplyFixture> {
  const base = await seedEditorFixture(db, label);
  const tag = base.sessionId.replace("pcs_", "");
  const fixture: ApplyFixture = {
    ...base,
    proposalId: `prop_${tag}`,
    estimateId: `est_${tag}`,
  };
  await db("proposals").insert({
    id: fixture.proposalId,
    org_id: fixture.orgId,
    number: 1,
    title: `${label} ${tag}`,
    client_name: "QA Client",
    status: "Preparing",
    currency: "NGN",
    created_by: fixture.actor,
  });
  await db("estimates").insert({
    id: fixture.estimateId,
    proposal_id: fixture.proposalId,
    revision_no: 1,
    status: "Draft",
    contingency_pct: 0,
    tax_label: "VAT",
    tax_pct: 7.5,
    subtotal: 0,
    tax_amount: 0,
    total: 0,
  });
  await db("precon_sessions").where({ id: fixture.sessionId }).update({ proposal_id: fixture.proposalId });
  return fixture;
}

export async function insertRow(db: Knex, fixture: ApplyFixture, row: SeedRow): Promise<void> {
  await db("precon_boq_rows").insert({
    id: row.id,
    bill_id: fixture.billId,
    sort: row.sort ?? 0,
    row_type: row.rowType ?? "item",
    element_group: row.elementGroup === undefined ? "Walls" : row.elementGroup,
    description: row.description,
    unit: row.unit ?? "m2",
    qty_gross: row.qty,
    qty: row.qty,
    rate: row.rate ?? 0,
    amount: (row.rate ?? 0) * row.qty,
    deductions: JSON.stringify([]),
    status: row.status ?? "verified",
    version: 1,
    origin: "manual",
  });
}

export async function estimateItems(db: Knex, estimateId: string): Promise<Record<string, unknown>[]> {
  return db("estimate_items").where({ estimate_id: estimateId }).orderBy("sort", "asc").select("*");
}

export async function estimateTotals(db: Knex, estimateId: string): Promise<Record<string, unknown>> {
  const row = await db("estimates").where({ id: estimateId }).first("subtotal", "tax_amount", "total", "status");
  return row as Record<string, unknown>;
}

export async function dropApplyFixture(db: Knex, fixture: ApplyFixture): Promise<void> {
  await db("estimate_items").where({ estimate_id: fixture.estimateId }).delete();
  await db("estimates").where({ id: fixture.estimateId }).delete();
  await db("proposal_events").where({ proposal_id: fixture.proposalId }).delete();
  await db("precon_sessions").where({ id: fixture.sessionId }).update({ proposal_id: null });
  await dropEditorFixture(db, fixture);
  await db("proposals").where({ id: fixture.proposalId }).delete();
}

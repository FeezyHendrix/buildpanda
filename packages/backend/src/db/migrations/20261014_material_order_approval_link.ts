import type { Knex } from "knex";
import { sameMaterial } from "../../modules/materials-ledger/units.ts";

/**
 * An order now names the material approval it was placed against. Until now
 * the two met only through an exact, case-folded material name, so "Bags of
 * cement" on the order never found the approved "Cement", and nothing on
 * either record said which sign-off an order relied on.
 *
 * Existing orders are linked to the latest approval of the same material in
 * their project (following resubmissions to the newest request), using the
 * same name rule the stock ledger uses. Orders with no such approval stay
 * unlinked: an order without a sign-off is allowed, it is just visible.
 */

interface ApprovalCandidate {
  id: string;
  project_id: string;
  material_name: string;
  created_at: Date;
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_orders", (table) => {
    table.text("approval_id").nullable().references("id").inTable("approvals").onDelete("SET NULL");
    table.index(["approval_id"]);
  });

  // A request that was resubmitted is superseded; the newest one speaks for it.
  const approvals: ApprovalCandidate[] = await knex("approvals as a")
    .join("material_approval_details as d", "d.approval_id", "a.id")
    .where("a.kind", "material")
    .whereNotExists(knex("approvals as n").whereRaw("n.resubmitted_from_id = a.id"))
    .orderBy("a.created_at", "desc")
    .select("a.id", "a.project_id", "d.material_name", "a.created_at");
  const byProject = new Map<string, ApprovalCandidate[]>();
  for (const approval of approvals) {
    byProject.set(approval.project_id, [...(byProject.get(approval.project_id) ?? []), approval]);
  }

  const orders: Array<{ id: string; project_id: string; material_name: string }> = await knex("material_orders")
    .whereIn("project_id", [...byProject.keys()])
    .select("id", "project_id", "material_name");
  for (const order of orders) {
    const match = byProject.get(order.project_id)?.find((a) => sameMaterial(a.material_name, order.material_name));
    if (match) await knex("material_orders").where({ id: order.id }).update({ approval_id: match.id });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_orders", (table) => {
    table.dropIndex(["approval_id"]);
    table.dropColumn("approval_id");
  });
}

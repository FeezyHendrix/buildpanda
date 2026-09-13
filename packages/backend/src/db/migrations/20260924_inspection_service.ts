import type { Knex } from "knex";

/**
 * An inspection is not a contractor's internal QA note. It is an independent
 * inspection service: the CLIENT (employer/homeowner) asks BuildPanda for one,
 * BuildPanda sends its own inspector, and the inspector reports on whoever is
 * building — whether that builder is one of our customer workspaces or a third
 * party the client has no account for.
 *
 * So the record needs three things it never had: who ASKED (and from which
 * side of the contract), who is being INSPECTED (the contractor is the subject,
 * never the author), and where the service order has got to — requested →
 * scheduled with an assigned inspector → attended → reported → (re-inspection).
 *
 * The fee is RECORDED, never charged: BuildPanda is a bookkeeping system and no
 * money passes through it. `fee_amount` is a figure a human agreed off-platform.
 *
 * The existing `status` (Scheduled / Completed / Action Required) stays exactly
 * as it was — it is the outcome-facing label the project UI reads.
 */

const SERVICE_STATUSES = [
  "Requested",
  "Scheduled",
  "Attended",
  "Reported",
  "Cancelled",
] as const;
const REQUESTER_SIDES = ["client", "contractor"] as const;

function check(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("inspections", (table) => {
    // The client who ordered the service. Nullable because rows predating this
    // migration were created before anyone recorded who asked.
    table.text("requested_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("requested_by_side").notNullable().defaultTo("client");
    // The party being inspected. Defaults to the project's contractor entity,
    // but a third-party builder with no account is just a name.
    table.text("contractor_name");
    table.text("service_status").notNullable().defaultTo("Requested");
    table.timestamp("report_issued_at", { useTz: true });
    // Logged, not transacted: what the client agreed to pay, recorded here.
    table.decimal("fee_amount", 14, 2);
    table.text("fee_currency");
    // The BuildPanda inspector. This — not inspector_name, which is display
    // text — is what the independence check in the service compares against.
    table.text("inspector_user_id").references("id").inTable("user").onDelete("SET NULL");
    table.index(["service_status"]);
    table.index(["inspector_user_id"]);
  });

  await knex.raw(
    `ALTER TABLE inspections ADD CONSTRAINT inspections_service_status_check
       CHECK (service_status IN (${check(SERVICE_STATUSES)}))`,
  );
  await knex.raw(
    `ALTER TABLE inspections ADD CONSTRAINT inspections_requested_by_side_check
       CHECK (requested_by_side IN (${check(REQUESTER_SIDES)}))`,
  );

  // Existing rows: anything already inspected has been reported; everything
  // else is sitting on the programme waiting, i.e. scheduled.
  await knex.raw(
    `UPDATE inspections
        SET service_status = CASE
              WHEN inspected_at IS NOT NULL OR outcome IS NOT NULL
                   OR status IN ('Completed', 'Action Required') THEN 'Reported'
              ELSE 'Scheduled'
            END,
            report_issued_at = inspected_at,
            inspector_user_id = inspected_by_id`,
  );

  // The subject and the requester, as best the existing data can say: the
  // project's contractor entity is who was being inspected, and the project
  // owner is who the work was being reported to.
  await knex.raw(
    `UPDATE inspections i
        SET contractor_name = p.contractor_entity,
            requested_by_id = p.owner_id
       FROM projects p
      WHERE p.id = i.project_id`,
  );

  // --- The category list is BuildPanda's service catalogue -----------------
  //
  // Every project now sees the global catalogue PLUS its own workspace's
  // additions. The 20260922 seed copied the same ten names into every
  // organisation, so without this every picker would show each one twice.
  // Seed rows are identifiable: nobody created them (created_by_id IS NULL).
  // Inspections pointing at a duplicate are repointed at the global row first,
  // so nothing loses its category.
  await knex.raw(
    `UPDATE inspections i
        SET category_id = g.id
       FROM inspection_categories dup
       JOIN inspection_categories g
         ON g.organization_id IS NULL AND g.project_id IS NULL
        AND lower(g.name) = lower(dup.name)
      WHERE i.category_id = dup.id
        AND dup.organization_id IS NOT NULL
        AND dup.created_by_id IS NULL`,
  );
  await knex.raw(
    `DELETE FROM inspection_categories dup
      USING inspection_categories g
      WHERE dup.organization_id IS NOT NULL
        AND dup.created_by_id IS NULL
        AND g.organization_id IS NULL
        AND g.project_id IS NULL
        AND lower(g.name) = lower(dup.name)`,
  );

  // The global list had no uniqueness of its own — the 20260922 partial indexes
  // only cover org-owned and project-owned rows.
  await knex.raw(
    `CREATE UNIQUE INDEX inspection_categories_global_name_idx
       ON inspection_categories (lower(name))
     WHERE organization_id IS NULL AND project_id IS NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS inspection_categories_global_name_idx");
  await knex.raw(
    "ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_requested_by_side_check",
  );
  await knex.raw(
    "ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_service_status_check",
  );
  await knex.schema.alterTable("inspections", (table) => {
    table.dropIndex(["inspector_user_id"]);
    table.dropIndex(["service_status"]);
    table.dropColumn("inspector_user_id");
    table.dropColumn("fee_currency");
    table.dropColumn("fee_amount");
    table.dropColumn("report_issued_at");
    table.dropColumn("service_status");
    table.dropColumn("contractor_name");
    table.dropColumn("requested_by_side");
    table.dropColumn("requested_by_id");
  });
}

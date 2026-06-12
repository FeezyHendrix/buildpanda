import type { Knex } from "knex";

const LEAD_STATUS = ["New", "Contacted", "Qualified", "ProposalOpened", "Won", "Lost"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("leads", (table) => {
    table.text("id").primary();
    // null = unassigned platform lead (from marketing site consultation form)
    table.text("org_id").references("id").inTable("organization").onDelete("SET NULL");
    table.text("name").notNullable();
    table.text("email").notNullable();
    table.text("phone");
    table.text("location");
    table.text("project_type");
    table.text("message");
    table.text("source").notNullable().defaultTo("website");
    table.text("status").notNullable().defaultTo("New");
    table.text("assigned_to").references("id").inTable("user").onDelete("SET NULL");
    table.text("notes");
    // adoption tracking: who assigned this platform lead to an org
    table.text("adopted_by").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("adopted_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["org_id", "status"]);
    table.index(["status"]);
    table.index(["created_at"]);
  });
  await knex.raw(
    `ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN (${check(LEAD_STATUS)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("leads");
}

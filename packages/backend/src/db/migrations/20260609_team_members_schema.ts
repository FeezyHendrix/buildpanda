import type { Knex } from "knex";

const TEAM_MEMBER_STATUSES = ["Active", "Inactive"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("team_members", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("role").notNullable();
    table.text("company");
    table.text("email");
    table.text("phone");
    table.text("responsibilities");
    table.text("status").notNullable().defaultTo("Active");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE team_members ADD CONSTRAINT team_members_status_check CHECK (status IN (${check(TEAM_MEMBER_STATUSES)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("team_members");
}

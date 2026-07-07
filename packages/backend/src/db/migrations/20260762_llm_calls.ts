import type { Knex } from "knex";

const STATUSES = ["valid", "repaired", "failed", "unvalidated"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("llm_calls", (table) => {
    table.text("id").primary();
    table.text("prompt_id");
    table.text("prompt_version");
    table.text("model_version");
    table.text("seed");
    table.integer("tokens_in");
    table.integer("tokens_out");
    table.integer("latency_ms");
    table.text("validation_status").notNullable();
    table.integer("retry_count").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["created_at"]);
    table.index(["model_version", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE llm_calls ADD CONSTRAINT llm_calls_status_check CHECK (validation_status IN (${STATUSES.map((s) => `'${s}'`).join(", ")}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("llm_calls");
}

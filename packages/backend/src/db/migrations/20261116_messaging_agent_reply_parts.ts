import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("messaging_agent_outbox", (table) => {
    table.integer("part_index").notNullable().defaultTo(0);
    table.integer("part_count").notNullable().defaultTo(1);
    table.text("reply_group");
    table.text("review_id").references("id").inTable("messaging_agent_proposals");
    table.integer("review_version");
    table.text("review_status");
    table.index(["reply_group", "part_index"]);
  });
  await db.raw("ALTER TABLE messaging_agent_outbox ADD CONSTRAINT messaging_agent_reply_parts_check CHECK (part_index >= 0 AND part_count BETWEEN 1 AND 20 AND part_index < part_count AND (part_count = 1 OR reply_group IS NOT NULL)), ADD CONSTRAINT messaging_agent_reply_review_check CHECK ((review_id IS NULL AND review_version IS NULL AND review_status IS NULL) OR (review_id IS NOT NULL AND review_version > 0 AND review_status IN ('draft','confirmed','completed','cancelled')))");
}

export async function down(db: Knex): Promise<void> {
  if (await db("messaging_agent_outbox").where("part_count", ">", 1).first("id")) throw new Error("Cannot remove ordered delivery while multipart messaging replies exist");
  await db.schema.alterTable("messaging_agent_outbox", (table) => {
    table.dropIndex(["reply_group", "part_index"]);
    table.dropColumns("part_index", "part_count", "reply_group", "review_id", "review_version", "review_status");
  });
}

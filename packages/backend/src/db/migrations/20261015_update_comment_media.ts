import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("update_comments", (table) => {
    table.text("body_html").nullable();
    table.string("audio_file_id", 160).nullable().references("id").inTable("uploaded_files");
    table.integer("audio_duration_seconds").nullable();
    table.string("client_mutation_id", 160).nullable();
    table.unique(["update_id", "author_id", "client_mutation_id"], { indexName: "update_comment_retry_unique" });
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable("update_comments", (table) => {
    table.dropUnique(["update_id", "author_id", "client_mutation_id"], "update_comment_retry_unique");
    table.dropColumn("body_html");
    table.dropColumn("audio_file_id");
    table.dropColumn("audio_duration_seconds");
    table.dropColumn("client_mutation_id");
  });
}

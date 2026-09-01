import type { Knex } from "knex";

const PLATFORMS = ["android", "ios"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("ota_updates", (table) => {
    // The Expo Updates protocol requires the manifest id to be a UUID, so the
    // row id is that UUID rather than the usual generateId() prefixed string.
    table.uuid("id").primary();
    table.text("platform").notNullable();
    table.text("runtime_version").notNullable();
    table.text("launch_asset_key").notNullable();
    table.text("launch_asset_hash").notNullable();
    table.text("launch_asset_path").notNullable();
    table.jsonb("assets").notNullable().defaultTo("[]");
    table.text("commit_sha");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["platform", "runtime_version", "created_at"]);
  });

  await knex.raw(
    `ALTER TABLE ota_updates ADD CONSTRAINT ota_updates_platform_check CHECK (platform IN (${PLATFORMS.map((p) => `'${p}'`).join(", ")}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ota_updates");
}

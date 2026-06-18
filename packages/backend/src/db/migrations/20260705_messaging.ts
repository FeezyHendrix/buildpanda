import type { Knex } from "knex";

const CHANNEL_TYPE = ["project", "org", "dm", "group_dm"] as const;
const MEMBER_ROLE = ["admin", "member"] as const;
const NOTIFY_LEVEL = ["all", "mentions", "none"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("channels", (table) => {
    table.text("id").primary();
    table.text("type").notNullable();
    table.text("name");
    table.text("topic");
    table.text("project_id").references("id").inTable("projects").onDelete("CASCADE");
    table.text("organization_id");
    table.boolean("is_private").notNullable().defaultTo(false);
    table.timestamp("archived_at", { useTz: true });
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id"]);
    table.index(["organization_id"]);
  });

  await knex.raw(
    `ALTER TABLE channels ADD CONSTRAINT channels_type_check CHECK (type IN (${check(CHANNEL_TYPE)}))`,
  );
  await knex.raw(
    `ALTER TABLE channels ADD CONSTRAINT channels_scope_check CHECK (
      (type = 'project' AND project_id IS NOT NULL AND organization_id IS NULL)
      OR (type = 'org' AND organization_id IS NOT NULL AND project_id IS NULL)
      OR (type IN ('dm', 'group_dm') AND project_id IS NULL AND organization_id IS NULL)
    )`,
  );

  await knex.schema.createTable("channel_members", (table) => {
    table.text("id").primary();
    table.text("channel_id").notNullable().references("id").inTable("channels").onDelete("CASCADE");
    table.text("user_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("role").notNullable().defaultTo("member");
    table.text("last_read_message_id");
    table.timestamp("last_read_at", { useTz: true });
    table.boolean("muted").notNullable().defaultTo(false);
    table.text("notify_level").notNullable().defaultTo("all");
    table.text("added_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["channel_id", "user_id"]);
    table.index(["user_id"]);
  });

  await knex.raw(
    `ALTER TABLE channel_members ADD CONSTRAINT channel_members_role_check CHECK (role IN (${check(MEMBER_ROLE)}))`,
  );
  await knex.raw(
    `ALTER TABLE channel_members ADD CONSTRAINT channel_members_notify_check CHECK (notify_level IN (${check(NOTIFY_LEVEL)}))`,
  );

  await knex.schema.createTable("messages", (table) => {
    table.text("id").primary();
    table.text("channel_id").notNullable().references("id").inTable("channels").onDelete("CASCADE");
    table.text("author_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("body").notNullable().defaultTo("");
    table.text("content_html");
    table.text("parent_message_id").references("id").inTable("messages").onDelete("CASCADE");
    table.jsonb("references").notNullable().defaultTo("[]");
    table.jsonb("mentions").notNullable().defaultTo("[]");
    table.jsonb("attachments").notNullable().defaultTo("[]");
    table.timestamp("edited_at", { useTz: true });
    table.timestamp("deleted_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["channel_id", "created_at"]);
    table.index(["parent_message_id"]);
  });

  await knex.schema.createTable("message_reactions", (table) => {
    table.text("id").primary();
    table.text("message_id").notNullable().references("id").inTable("messages").onDelete("CASCADE");
    table.text("user_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("emoji").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["message_id", "user_id", "emoji"]);
  });

  await knex.schema.createTable("pinned_messages", (table) => {
    table.text("id").primary();
    table.text("channel_id").notNullable().references("id").inTable("channels").onDelete("CASCADE");
    table.text("message_id").notNullable().references("id").inTable("messages").onDelete("CASCADE");
    table.text("pinned_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["channel_id", "message_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("pinned_messages");
  await knex.schema.dropTableIfExists("message_reactions");
  await knex.schema.dropTableIfExists("messages");
  await knex.schema.dropTableIfExists("channel_members");
  await knex.schema.dropTableIfExists("channels");
}

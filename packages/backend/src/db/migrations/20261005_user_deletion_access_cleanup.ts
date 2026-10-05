import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Watchtower and Better Auth delete users through different code paths. Keep
  // access cleanup atomic with either deletion, before SET NULL loses the link.
  await knex.raw(`
    CREATE FUNCTION revoke_deleted_user_access() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE project_participants
      SET status = 'revoked',
          invite_token = NULL,
          invite_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('active', 'invited')
        AND (
          user_id = OLD.id
          OR (user_id IS NULL AND lower(email) = lower(OLD.email))
        );

      UPDATE invitation
      SET status = 'canceled'
      WHERE status = 'pending' AND lower(email) = lower(OLD.email);

      RETURN OLD;
    END;
    $$;

    CREATE TRIGGER user_delete_revoke_access
    BEFORE DELETE ON "user"
    FOR EACH ROW EXECUTE FUNCTION revoke_deleted_user_access();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS user_delete_revoke_access ON "user";
    DROP FUNCTION IF EXISTS revoke_deleted_user_access();
  `);
}

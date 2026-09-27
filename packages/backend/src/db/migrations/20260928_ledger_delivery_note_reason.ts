import type { Knex } from "knex";

/**
 * A receipt booked from a delivery used to copy the delivery-note number into
 * `reason` as well as into its own column. The ledger renders `reason` as the
 * explanation for the movement, so the note number showed up twice — once
 * correctly and once under a label meant for a void. The write no longer
 * duplicates it (materials-equipment/wiring.ts); this clears the copies already
 * on the ledger, and only where the text is exactly that duplicate.
 */
export async function up(knex: Knex): Promise<void> {
  await knex("material_ledger_entries")
    .whereNotNull("delivery_note")
    .whereRaw("reason = 'Delivery note ' || delivery_note")
    .update({ reason: null, updated_at: new Date().toISOString() });
}

export async function down(knex: Knex): Promise<void> {
  await knex("material_ledger_entries")
    .whereNotNull("delivery_note")
    .whereNull("reason")
    .where({ entry_type: "IN" })
    .update({
      reason: knex.raw("'Delivery note ' || delivery_note"),
      updated_at: new Date().toISOString(),
    });
}

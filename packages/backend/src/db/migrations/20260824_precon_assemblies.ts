import type { Knex } from "knex";

/**
 * Assemblies: one drawn quantity that bills as several items. A wall length
 * measured once becomes blockwork, plaster to both faces, paint and a DPC,
 * each at its own factor, unit and rate. They belong to the organisation's
 * rate library, not to a take-off, so every estimator measures the same way.
 *
 * `items` is a jsonb list of { description, unit, factor, elementGroup,
 * rateId, code }; a rate that is later deleted leaves the item unpriced
 * rather than breaking the assembly, which is why it is not a foreign key.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("precon_assemblies", (table) => {
    table.text("id").primary();
    table.text("org_id").notNullable().references("id").inTable("organization").onDelete("CASCADE");
    table.text("name").notNullable();
    // the unit the assembly is measured in: the drawn quantity every factor multiplies
    table.text("unit").notNullable();
    table.text("element_group").notNullable();
    table.jsonb("items").notNullable().defaultTo("[]");
    table.text("created_by");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["org_id", "name"]);
  });
  await knex.raw("ALTER TABLE precon_assemblies ADD CONSTRAINT precon_assemblies_items_check CHECK (jsonb_typeof(items) = 'array')");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("precon_assemblies");
}

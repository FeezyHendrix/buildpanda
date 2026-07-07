import type { Knex } from "knex";
import type { SupplierRow } from "./types.ts";

export interface NewSupplierRecord {
  id: string;
  project_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_by_id: string | null;
}

export type SupplierPatch = Partial<Omit<NewSupplierRecord, "id" | "project_id" | "created_by_id">> & {
  active?: boolean;
};

export function suppliersRepository(db: Knex) {
  return {
    listByProject(projectId: string, includeInactive = false): Promise<SupplierRow[]> {
      const query = db<SupplierRow>("suppliers").where({ project_id: projectId });
      if (!includeInactive) query.andWhere({ active: true });
      return query.orderBy("name", "asc");
    },

    findById(id: string): Promise<SupplierRow | undefined> {
      return db<SupplierRow>("suppliers").where({ id }).first();
    },

    async insert(record: NewSupplierRecord): Promise<SupplierRow> {
      const rows = await db<SupplierRow>("suppliers").insert(record).returning("*");
      return rows[0]!;
    },

    async update(id: string, patch: SupplierPatch): Promise<SupplierRow | undefined> {
      const rows = await db("suppliers")
        .where({ id })
        .update({ ...patch, updated_at: new Date() })
        .returning<SupplierRow[]>("*");
      return rows[0];
    },

    async delete(id: string): Promise<void> {
      await db("suppliers").where({ id }).del();
    },
  };
}

export type SuppliersRepository = ReturnType<typeof suppliersRepository>;

import type { Knex } from "knex";
import type { SupplierOwner, SupplierRow } from "./types.ts";

export interface NewSupplierRecord {
  id: string;
  project_id: string | null;
  organization_id: string | null;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  trade: string | null;
  approved: boolean;
  lead_time_days: number | null;
  payment_terms: string | null;
  created_by_id: string | null;
}

export type SupplierPatch = Partial<
  Omit<NewSupplierRecord, "id" | "project_id" | "organization_id" | "created_by_id">
> & {
  active?: boolean;
};

export function suppliersRepository(db: Knex) {
  // A supplier the QS can use on this job is either one raised on the job or
  // one on the company register. Both are returned by one query so the picker
  // never has to merge two lists.
  function inScope(query: Knex.QueryBuilder, owner: SupplierOwner): Knex.QueryBuilder {
    return query.where((q) => {
      q.where({ project_id: owner.projectId });
      if (owner.organizationId) q.orWhere({ organization_id: owner.organizationId });
    });
  }

  return {
    listInScope(owner: SupplierOwner, includeInactive = false): Promise<SupplierRow[]> {
      const query = inScope(db<SupplierRow>("suppliers"), owner);
      if (!includeInactive) query.andWhere({ active: true });
      return query.orderBy("name", "asc");
    },

    findById(id: string): Promise<SupplierRow | undefined> {
      return db<SupplierRow>("suppliers").where({ id }).first();
    },

    /**
     * Same email or same phone inside the caller's scope. A supplier typed
     * twice ("Ogun Quarries" / "Ogun Quarries Ltd") is one account, and the
     * contact details are what give it away.
     */
    findDuplicate(
      owner: SupplierOwner,
      contact: { email: string | null; phone: string | null },
    ): Promise<SupplierRow | undefined> {
      if (!contact.email && !contact.phone) return Promise.resolve(undefined);
      return inScope(db<SupplierRow>("suppliers"), owner)
        .andWhere((q) => {
          if (contact.email) q.orWhereRaw("lower(email) = ?", [contact.email.toLowerCase()]);
          if (contact.phone) q.orWhere({ phone: contact.phone });
        })
        .first();
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

import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso } from "../../lib/dates.ts";
import type { SupplierPatch, SuppliersRepository } from "./repository.ts";
import type {
  CreateSupplierInput,
  Supplier,
  SupplierOwner,
  SupplierRow,
  UpdateSupplierInput,
} from "./types.ts";

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    projectId: row.project_id,
    organizationId: row.organization_id,
    scope: row.project_id ? "project" : "organization",
    name: row.name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    trade: row.trade,
    approved: row.approved,
    leadTimeDays: row.lead_time_days,
    paymentTerms: row.payment_terms,
    active: row.active,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function suppliersService(repository: SuppliersRepository) {
  // Readable and writable from this job: raised here, or on the company
  // register the job belongs to.
  function visible(row: SupplierRow, owner: SupplierOwner): boolean {
    if (row.project_id === owner.projectId) return true;
    return Boolean(owner.organizationId) && row.organization_id === owner.organizationId;
  }

  async function owned(owner: SupplierOwner, id: string): Promise<SupplierRow> {
    const row = await repository.findById(id);
    if (!row || !visible(row, owner)) throw new NotFoundError("Supplier");
    return row;
  }

  return {
    async list(owner: SupplierOwner, includeInactive = false): Promise<Supplier[]> {
      const rows = await repository.listInScope(owner, includeInactive);
      return rows.map(toSupplier);
    },

    async get(owner: SupplierOwner, id: string): Promise<Supplier> {
      return toSupplier(await owned(owner, id));
    },

    async create(
      owner: SupplierOwner,
      input: CreateSupplierInput,
      actorId: string | null,
    ): Promise<Supplier> {
      const name = input.name.trim();
      if (!name) throw new BadRequestError("Supplier name is required");
      if (input.leadTimeDays !== undefined && input.leadTimeDays !== null && input.leadTimeDays < 0) {
        throw new BadRequestError("Lead time must be zero or more days");
      }

      const email = optionalText(input.email) ?? null;
      const phone = optionalText(input.phone) ?? null;
      if (!input.force) {
        const duplicate = await repository.findDuplicate(owner, { email, phone });
        if (duplicate) {
          throw new ConflictError(
            `${duplicate.name} is already on the supplier register with the same email or phone`,
            { existingId: duplicate.id, existingName: duplicate.name },
          );
        }
      }

      // Company scope needs a company: without one the supplier would be
      // visible to nobody, so it stays on the project that raised it.
      const companyWide = input.scope === "organization" && Boolean(owner.organizationId);
      const row = await repository.insert({
        id: generateId("sup"),
        project_id: companyWide ? null : owner.projectId,
        organization_id: owner.organizationId,
        name,
        contact_name: optionalText(input.contactName) ?? null,
        email,
        phone,
        address: optionalText(input.address) ?? null,
        notes: optionalText(input.notes) ?? null,
        trade: optionalText(input.trade) ?? null,
        approved: input.approved ?? false,
        lead_time_days: input.leadTimeDays ?? null,
        payment_terms: optionalText(input.paymentTerms) ?? null,
        created_by_id: actorId,
      });
      return toSupplier(row);
    },

    async update(owner: SupplierOwner, id: string, input: UpdateSupplierInput): Promise<Supplier> {
      await owned(owner, id);

      const patch: SupplierPatch = {};
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw new BadRequestError("Supplier name is required");
        patch.name = name;
      }
      if (input.contactName !== undefined) patch.contact_name = optionalText(input.contactName) ?? null;
      if (input.email !== undefined) patch.email = optionalText(input.email) ?? null;
      if (input.phone !== undefined) patch.phone = optionalText(input.phone) ?? null;
      if (input.address !== undefined) patch.address = optionalText(input.address) ?? null;
      if (input.notes !== undefined) patch.notes = optionalText(input.notes) ?? null;
      if (input.trade !== undefined) patch.trade = optionalText(input.trade) ?? null;
      if (input.approved !== undefined) patch.approved = input.approved;
      if (input.leadTimeDays !== undefined) {
        if (input.leadTimeDays !== null && input.leadTimeDays < 0) {
          throw new BadRequestError("Lead time must be zero or more days");
        }
        patch.lead_time_days = input.leadTimeDays;
      }
      if (input.paymentTerms !== undefined) patch.payment_terms = optionalText(input.paymentTerms) ?? null;
      if (input.active !== undefined) patch.active = input.active;

      const row = await repository.update(id, patch);
      if (!row) throw new NotFoundError("Supplier");
      return toSupplier(row);
    },

    async remove(owner: SupplierOwner, id: string): Promise<void> {
      await owned(owner, id);
      await repository.delete(id);
    },
  };
}

export type SuppliersService = ReturnType<typeof suppliersService>;

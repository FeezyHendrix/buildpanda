import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso } from "../../lib/dates.ts";
import type { SuppliersRepository } from "./repository.ts";
import type { CreateSupplierInput, Supplier, SupplierRow, UpdateSupplierInput } from "./types.ts";

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
    name: row.name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    active: row.active,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function suppliersService(repository: SuppliersRepository) {
  return {
    async list(projectId: string, includeInactive = false): Promise<Supplier[]> {
      const rows = await repository.listByProject(projectId, includeInactive);
      return rows.map(toSupplier);
    },

    async get(projectId: string, id: string): Promise<Supplier> {
      const row = await repository.findById(id);
      if (!row || row.project_id !== projectId) throw new NotFoundError("Supplier");
      return toSupplier(row);
    },

    async create(projectId: string, input: CreateSupplierInput, actorId: string | null): Promise<Supplier> {
      const name = input.name.trim();
      if (!name) throw new BadRequestError("Supplier name is required");
      const row = await repository.insert({
        id: generateId("sup"),
        project_id: projectId,
        name,
        contact_name: optionalText(input.contactName) ?? null,
        email: optionalText(input.email) ?? null,
        phone: optionalText(input.phone) ?? null,
        address: optionalText(input.address) ?? null,
        notes: optionalText(input.notes) ?? null,
        created_by_id: actorId,
      });
      return toSupplier(row);
    },

    async update(projectId: string, id: string, input: UpdateSupplierInput): Promise<Supplier> {
      const existing = await repository.findById(id);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Supplier");

      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw new BadRequestError("Supplier name is required");
        patch["name"] = name;
      }
      if (input.contactName !== undefined) patch["contact_name"] = optionalText(input.contactName);
      if (input.email !== undefined) patch["email"] = optionalText(input.email);
      if (input.phone !== undefined) patch["phone"] = optionalText(input.phone);
      if (input.address !== undefined) patch["address"] = optionalText(input.address);
      if (input.notes !== undefined) patch["notes"] = optionalText(input.notes);
      if (input.active !== undefined) patch["active"] = input.active;

      const row = await repository.update(id, patch);
      if (!row) throw new NotFoundError("Supplier");
      return toSupplier(row);
    },

    async remove(projectId: string, id: string): Promise<void> {
      const existing = await repository.findById(id);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Supplier");
      await repository.delete(id);
    },
  };
}

export type SuppliersService = ReturnType<typeof suppliersService>;

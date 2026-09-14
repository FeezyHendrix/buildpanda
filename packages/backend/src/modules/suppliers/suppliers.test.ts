import { test } from "node:test";
import assert from "node:assert/strict";
import { suppliersService } from "./service.ts";
import type { SuppliersRepository } from "./repository.ts";
import type { SupplierOwner, SupplierRow } from "./types.ts";

const OWNER: SupplierOwner = { projectId: "prj_1", organizationId: "org_1" };

function row(overrides: Partial<SupplierRow> = {}): SupplierRow {
  return {
    id: "sup_1",
    project_id: "prj_1",
    organization_id: "org_1",
    name: "Ogun Quarries",
    contact_name: null,
    email: "sales@ogunquarries.ng",
    phone: "+2348030000000",
    address: null,
    notes: null,
    trade: "Aggregates",
    approved: true,
    lead_time_days: 7,
    payment_terms: "30 days",
    active: true,
    created_by_id: "usr_1",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function fakeRepo(seed: SupplierRow[] = []) {
  const store = new Map(seed.map((r) => [r.id, r]));
  let counter = seed.length;
  const repository = {
    listInScope: async (owner: SupplierOwner, includeInactive = false) =>
      [...store.values()].filter(
        (r) =>
          (r.project_id === owner.projectId ||
            (Boolean(owner.organizationId) && r.organization_id === owner.organizationId)) &&
          (includeInactive || r.active),
      ),
    findById: async (id: string) => store.get(id),
    findDuplicate: async (owner: SupplierOwner, contact: { email: string | null; phone: string | null }) => {
      if (!contact.email && !contact.phone) return undefined;
      return [...store.values()].find(
        (r) =>
          (r.project_id === owner.projectId || r.organization_id === owner.organizationId) &&
          ((contact.email && r.email?.toLowerCase() === contact.email.toLowerCase()) ||
            (contact.phone && r.phone === contact.phone)),
      );
    },
    insert: async (record: Record<string, unknown>) => {
      counter += 1;
      const created = row({ ...(record as Partial<SupplierRow>), id: `sup_${counter}` });
      store.set(created.id, created);
      return created;
    },
    update: async (id: string, patch: Record<string, unknown>) => {
      const current = store.get(id);
      if (!current) return undefined;
      const next = { ...current, ...patch } as SupplierRow;
      store.set(id, next);
      return next;
    },
    delete: async (id: string) => {
      store.delete(id);
    },
  } as unknown as SuppliersRepository;
  return { repository, store };
}

test("the same supplier typed twice is refused with the record it collides with", async () => {
  const fake = fakeRepo([row()]);
  const service = suppliersService(fake.repository);
  await assert.rejects(
    service.create(
      OWNER,
      { name: "Ogun Quarries Ltd", email: "SALES@ogunquarries.ng" },
      "usr_1",
    ),
    (error: Error & { details?: { existingId?: string } }) => {
      assert.match(error.message, /already on the supplier register/i);
      assert.equal(error.details?.existingId, "sup_1");
      return true;
    },
  );
});

test("a matching phone is enough to flag the duplicate", async () => {
  const service = suppliersService(fakeRepo([row()]).repository);
  await assert.rejects(
    service.create(OWNER, { name: "Ogun Quarries Ltd", phone: "+2348030000000" }, "usr_1"),
    /already on the supplier register/i,
  );
});

test("force saves the supplier anyway, for the genuinely separate depot", async () => {
  const fake = fakeRepo([row()]);
  const service = suppliersService(fake.repository);
  const created = await service.create(
    OWNER,
    { name: "Ogun Quarries (Sagamu depot)", phone: "+2348030000000", force: true },
    "usr_1",
  );
  assert.equal(created.name, "Ogun Quarries (Sagamu depot)");
  assert.equal(fake.store.size, 2);
});

test("a supplier with no contact details cannot collide with anything", async () => {
  const service = suppliersService(fakeRepo([row()]).repository);
  const created = await service.create(OWNER, { name: "Costain Precast" }, "usr_1");
  assert.equal(created.name, "Costain Precast");
});

test("a company-wide supplier is not pinned to the job that raised it", async () => {
  const fake = fakeRepo();
  const service = suppliersService(fake.repository);
  const created = await service.create(
    OWNER,
    { name: "Dangote", scope: "organization", trade: "Cement", approved: true, leadTimeDays: 3 },
    "usr_1",
  );
  assert.equal(created.scope, "organization");
  assert.equal(created.projectId, null);
  assert.equal(created.organizationId, "org_1");
  assert.equal(created.trade, "Cement");
  assert.equal(created.approved, true);
  assert.equal(created.leadTimeDays, 3);
});

test("the register a job sees is its own suppliers plus the company's", async () => {
  const fake = fakeRepo([
    row({ id: "sup_project", project_id: "prj_1" }),
    row({ id: "sup_company", project_id: null }),
    row({ id: "sup_other_job", project_id: "prj_2", organization_id: "org_2" }),
  ]);
  const service = suppliersService(fake.repository);
  const listed = await service.list(OWNER);
  assert.deepEqual(listed.map((s) => s.id).sort(), ["sup_company", "sup_project"]);
});

test("a supplier on another company's register is not readable from this job", async () => {
  const fake = fakeRepo([row({ id: "sup_other", project_id: "prj_2", organization_id: "org_2" })]);
  const service = suppliersService(fake.repository);
  await assert.rejects(service.get(OWNER, "sup_other"), /not found/i);
});

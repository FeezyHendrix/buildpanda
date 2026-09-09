import { test } from "node:test";
import assert from "node:assert/strict";
import { complianceDocsService, complianceStatus } from "./service.ts";
import type { ComplianceDocsRepository } from "./repository.ts";
import type { ComplianceDocRow } from "./types.ts";

function row(overrides: Partial<ComplianceDocRow> = {}): ComplianceDocRow {
  return {
    id: "pcd_1",
    org_id: "org_1",
    file_name: "car-policy.pdf",
    storage_path: "uploads/u1/car-policy.pdf",
    file_id: "file_1",
    doc_type: "insurance_car",
    reference: "POL-2026-001",
    notes: null,
    expiry_date: "2027-01-31",
    uploaded_by: "usr_1",
    expiring_notified_at: null,
    expired_notified_at: null,
    created_at: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function fakeRepo(overrides: Partial<Record<keyof ComplianceDocsRepository, unknown>> = {}): ComplianceDocsRepository {
  return {
    listByOrg: async () => [row()],
    byId: async () => row(),
    insert: async (r: ComplianceDocRow) => ({ ...row(), ...r }),
    update: async (_id: string, patch: Partial<ComplianceDocRow>) => ({ ...row(), ...patch }),
    delete: async () => 1,
    expiringBetween: async () => [],
    expiredBefore: async () => [],
    orgAdminUserIds: async () => [],
    ...overrides,
  } as unknown as ComplianceDocsRepository;
}

test("complianceStatus buckets by expiry date", () => {
  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 5);
  assert.equal(complianceStatus(null).status, "no_expiry");
  assert.equal(complianceStatus("2020-01-01").status, "expired");
  assert.equal(complianceStatus(soon.toISOString().slice(0, 10)).status, "expiring");
  assert.equal(complianceStatus("2099-01-01").status, "valid");
});

test("create copies the stored file's name and path and refuses someone else's upload", async () => {
  const files = new Map([["file_1", { id: "file_1", file_name: "bond.pdf", storage_path: "s/bond.pdf", owner_id: "usr_1" }]]);
  const svc = complianceDocsService(fakeRepo(), async (id) => files.get(id));
  const doc = await svc.create("org_1", "usr_1", { fileId: "file_1", docType: "performance_bond", expiryDate: "2099-01-01" });
  assert.equal(doc.fileName, "bond.pdf");
  assert.equal(doc.docType, "performance_bond");
  assert.equal(doc.status, "valid");
  await assert.rejects(svc.create("org_1", "usr_2", { fileId: "file_1", docType: "other" }), /yourself/);
  await assert.rejects(svc.create("org_1", "usr_1", { fileId: "missing", docType: "other" }), /Uploaded file/);
});

test("changing the expiry date restarts the reminder cycle", async () => {
  let captured: Partial<ComplianceDocRow> | null = null;
  const svc = complianceDocsService(
    fakeRepo({
      update: async (_id: string, patch: Partial<ComplianceDocRow>) => {
        captured = patch;
        return { ...row(), ...patch };
      },
    }),
    async () => undefined,
  );
  await svc.update("org_1", "pcd_1", { expiryDate: "2030-06-30" });
  assert.equal(captured!.expiry_date, "2030-06-30");
  assert.equal(captured!.expiring_notified_at, null);
  assert.equal(captured!.expired_notified_at, null);
});

test("documents from another organisation are not found", async () => {
  const svc = complianceDocsService(fakeRepo({ byId: async () => row({ org_id: "org_2" }) }), async () => undefined);
  await assert.rejects(svc.get("org_1", "pcd_1"), /Compliance document/);
});

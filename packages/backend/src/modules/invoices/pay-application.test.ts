import { test } from "node:test";
import assert from "node:assert/strict";
import {
  payApplicationService,
  type PayApplicationRepository,
  type StageInfo,
} from "./pay-application.ts";
import type { InvoiceStageLineRow } from "./types.ts";

function line(over: Partial<InvoiceStageLineRow>): InvoiceStageLineRow {
  return {
    id: "payln_x",
    project_id: "proj_1",
    invoice_id: "inv_1",
    stage_id: "stage_1",
    scheduled_value: "100000.00",
    this_period: "0.00",
    stored_materials: "0.00",
    retained: "0.00",
    sort_order: 0,
    created_at: "t",
    updated_at: "t",
    ...over,
  };
}

function fakeRepo(seedLines: InvoiceStageLineRow[]): PayApplicationRepository {
  const stored = new Map<string, InvoiceStageLineRow[]>();
  for (const seeded of seedLines) {
    const bucket = stored.get(seeded.invoice_id) ?? [];
    bucket.push(seeded);
    stored.set(seeded.invoice_id, bucket);
  }
  return {
    findById: async () => ({ project_id: "proj_1" }),
    listStageLines: async (invoiceId) => stored.get(invoiceId) ?? [],
    listStageLinesForStages: async (projectId, stageIds) =>
      [...stored.values()]
        .flat()
        .filter((l) => l.project_id === projectId && stageIds.includes(l.stage_id)),
    replaceStageLines: async (invoiceId, records) => {
      stored.set(
        invoiceId,
        records.map((r) => ({ ...r, created_at: "t", updated_at: "t" })),
      );
    },
  };
}

const stages = async (): Promise<Map<string, StageInfo>> =>
  new Map([
    ["stage_1", { name: "Superstructure", value: 100000 }],
    ["stage_2", { name: "Roofing", value: 50000 }],
  ]);

test("pay-app: single stage, no prior — AIA G702 totals match ernest", async () => {
  const svc = payApplicationService(fakeRepo([]), stages);
  const summary = await svc.set("proj_1", "inv_1", [
    { stageId: "stage_1", thisPeriod: 40000, retained: 4000 },
  ]);
  const l = summary.lines[0];
  assert.equal(l?.scheduledValue, 100000);
  assert.equal(l?.priorBilled, 0);
  assert.equal(l?.totalCompleted, 40000);
  assert.equal(l?.balanceToFinish, 60000);
  assert.equal(l?.percentComplete, 40);
  assert.equal(l?.currentPaymentDue, 36000);
  assert.equal(summary.currentPaymentDue, 36000);
});

test("pay-app: a prior application accumulates billedInPrevious (ernest)", async () => {
  const priorLine = line({ invoice_id: "inv_0", this_period: "30000.00" });
  const svc = payApplicationService(fakeRepo([priorLine]), stages);
  const summary = await svc.set("proj_1", "inv_1", [
    { stageId: "stage_1", thisPeriod: 40000, retained: 4000 },
  ]);
  const l = summary.lines[0];
  assert.equal(l?.priorBilled, 30000);
  assert.equal(l?.totalCompleted, 70000);
  assert.equal(l?.balanceToFinish, 30000);
  assert.equal(l?.percentComplete, 70);
  assert.equal(l?.currentPaymentDue, 36000);
});

test("pay-app: rejects billing beyond the stage scheduled value", async () => {
  const priorLine = line({ invoice_id: "inv_0", this_period: "70000.00" });
  const svc = payApplicationService(fakeRepo([priorLine]), stages);
  await assert.rejects(
    svc.set("proj_1", "inv_1", [{ stageId: "stage_1", thisPeriod: 40000 }]),
    /exceeds the stage scheduled value/,
  );
});

test("pay-app: multi-stage summary reconciles exactly", async () => {
  const svc = payApplicationService(fakeRepo([]), stages);
  const summary = await svc.set("proj_1", "inv_1", [
    { stageId: "stage_1", thisPeriod: 40000, storedMaterials: 5000, retained: 4500 },
    { stageId: "stage_2", thisPeriod: 25000, retained: 2500 },
  ]);
  assert.equal(summary.thisPeriodTotal, 65000);
  assert.equal(summary.storedMaterialsTotal, 5000);
  assert.equal(summary.retainedTotal, 7000);
  assert.equal(summary.currentPaymentDue, 63000);
  assert.equal(summary.scheduledTotal, 150000);
});

test("pay-app: an unknown stage is rejected", async () => {
  const svc = payApplicationService(fakeRepo([]), stages);
  await assert.rejects(
    svc.set("proj_1", "inv_1", [{ stageId: "stage_missing", thisPeriod: 100 }]),
    /Unknown stage/,
  );
});

test("pay-app: get() returns persisted lines with derived prior", async () => {
  const repo = fakeRepo([]);
  const svc = payApplicationService(repo, stages);
  await svc.set("proj_1", "inv_1", [
    { stageId: "stage_1", thisPeriod: 40000, retained: 4000 },
  ]);
  const summary = await svc.get("proj_1", "inv_1");
  assert.equal(summary.lines[0]?.thisPeriod, 40000);
  assert.equal(summary.currentPaymentDue, 36000);
});

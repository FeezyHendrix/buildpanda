import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPayApplicationPdf } from "./pay-application-pdf.ts";
import type { Invoice, PayApplicationSummary } from "./types.ts";

const invoice = {
  id: "inv_1",
  number: "PA-001",
  currency: "NGN",
  invoiceType: "progress",
  status: "Draft",
  issueDate: "2026-02-01",
  dueDate: "2026-03-03",
} as unknown as Invoice;

const summary: PayApplicationSummary = {
  lines: [
    {
      stageId: "s1",
      stageName: "Superstructure",
      scheduledValue: 100000,
      priorBilled: 30000,
      thisPeriod: 40000,
      storedMaterials: 0,
      totalCompleted: 70000,
      percentComplete: 70,
      balanceToFinish: 30000,
      retained: 4000,
      currentPaymentDue: 36000,
    },
    {
      stageId: "s2",
      stageName: "Roofing",
      scheduledValue: 50000,
      priorBilled: 0,
      thisPeriod: 25000,
      storedMaterials: 0,
      totalCompleted: 25000,
      percentComplete: 50,
      balanceToFinish: 25000,
      retained: 2500,
      currentPaymentDue: 22500,
    },
  ],
  scheduledTotal: 150000,
  priorBilledTotal: 30000,
  thisPeriodTotal: 65000,
  storedMaterialsTotal: 0,
  totalCompleted: 95000,
  balanceToFinish: 55000,
  retainedTotal: 6500,
  currentPaymentDue: 58500,
};

test("renders a valid, non-empty pay-application PDF", async () => {
  const pdf = await renderPayApplicationPdf(invoice, summary, null);
  assert.ok(pdf.length > 1000, "PDF should be non-trivial");
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
});

test("renders with no stage lines without throwing", async () => {
  const empty: PayApplicationSummary = {
    lines: [],
    scheduledTotal: 0,
    priorBilledTotal: 0,
    thisPeriodTotal: 0,
    storedMaterialsTotal: 0,
    totalCompleted: 0,
    balanceToFinish: 0,
    retainedTotal: 0,
    currentPaymentDue: 0,
  };
  const pdf = await renderPayApplicationPdf(invoice, empty, null);
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
});

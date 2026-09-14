import { test, expect } from "../fixtures/test";
import { InvoicesPage } from "../pages/invoices.pom";
import { uniqueName } from "../fixtures/ids";

interface Invoice {
  id: string;
  vendorName: string;
  amount: number;
  amountPaid: number;
  balanceDue: number;
}

async function getInvoice(api: import("../fixtures/api-client").ApiClient, projectId: string, vendor: string): Promise<Invoice> {
  const res = await api.get<Invoice[]>(`/projects/${projectId}/invoices`);
  const found = (res.body as Invoice[]).find((i) => i.vendorName === vendor);
  if (!found) throw new Error(`invoice not found for vendor ${vendor}`);
  return found;
}

/**
 * RISK MAP — Invoices & payments, the project's accounts-payable ledger.
 * - Upstream trigger: a vendor invoice is raised and partial payments recorded.
 * - Expected guardrail: balanceDue is ALWAYS amount(+retainage) minus the sum of
 *   payments — it must reconcile exactly after every payment, and a payment can
 *   never push amountPaid above the invoice (no over-payment / negative balance
 *   that would silently misstate what the business owes).
 * - Failure liability: a drifted balance means the business over-pays a vendor,
 *   under-reports liabilities, or double-pays — direct financial loss and books
 *   that don't tie out.
 */
test.describe("Invoices payment integrity @regression @invoices @finance", () => {
  test("a recorded payment reconciles amountPaid + balanceDue exactly @smoke", async ({ page, project, api }) => {
    const vendor = uniqueName("Adeyemi Builders");
    const amount = 1000;

    const invoices = new InvoicesPage(page, project.id);
    await invoices.goto();
    await invoices.createInvoice(vendor, amount);

    // Baseline via the API/DB layer (not the screen): nothing paid yet.
    const created = await getInvoice(api, project.id, vendor);
    expect(created.amountPaid).toBe(0);
    expect(created.balanceDue).toBe(amount);

    // Record a partial payment through the API and re-read the ledger.
    await api.postOrThrow(`/projects/${project.id}/invoices/${created.id}/payments`, { amount: 400 });
    const afterPartial = await getInvoice(api, project.id, vendor);

    // Guardrail: the books tie out exactly after the payment.
    expect(afterPartial.amountPaid).toBe(400);
    expect(afterPartial.balanceDue).toBe(amount - 400);
    expect(afterPartial.amountPaid + afterPartial.balanceDue).toBe(amount);
  });

  test("settling the invoice drives balanceDue to zero, never negative", async ({ page, project, api }) => {
    const vendor = uniqueName("Lekki Steel");
    const amount = 750;

    const invoices = new InvoicesPage(page, project.id);
    await invoices.goto();
    await invoices.createInvoice(vendor, amount);
    const inv = await getInvoice(api, project.id, vendor);

    // Two payments that exactly settle the invoice.
    await api.postOrThrow(`/projects/${project.id}/invoices/${inv.id}/payments`, { amount: 500 });
    await api.postOrThrow(`/projects/${project.id}/invoices/${inv.id}/payments`, { amount: 250 });

    const settled = await getInvoice(api, project.id, vendor);
    expect(settled.amountPaid).toBe(amount);
    // Guardrail: a fully-paid invoice reads exactly zero balance — never below.
    expect(settled.balanceDue).toBe(0);
    expect(settled.balanceDue).toBeGreaterThanOrEqual(0);
  });
});

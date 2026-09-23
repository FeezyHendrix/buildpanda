import type { Knex } from "knex";

/**
 * The certification chain the Finance overview's headline is derived from.
 *
 * `summary-repository.certifiedTotals()` and `paidTotal()` read RECEIVABLE
 * invoices — what the contractor certified to the employer — and nothing else.
 * Every invoice the demo had was payable (the back-fill in
 * `20260917_invoice_certificates` ran before those rows existed), so the card
 * derived 0 certified and 0 paid while the finances row claimed 45,100,000.
 *
 * The seeded `payment_claims` already tell the story, so the five Approved and
 * Paid claims become five interim payment certificates. Each one is built the
 * way `modules/invoices/ipc-seeding.ts` builds them, from the contract rather
 * than from form defaults: gross certified, less 5% retention, less 10%
 * advance recovery from IPC 2 onwards, plus 7.5% VAT. Nothing here is a
 * payment instruction — a certificate is a statement of what is due, and the
 * receipts against it record money the employer moved off-platform.
 */

const PROJECT_ID = "sample-project";
const EMPLOYER = "Adeyi Family Trust";
const CONTRACTOR = "Adeyemi Crew Ltd";
const CERT_IDS = ["fd_ipc1", "fd_ipc2", "fd_ipc3", "fd_ipc4", "fd_ipc5"];

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function money(n: number): string {
  return n.toFixed(2);
}

interface CertificateSpec {
  /** IPC number; recovery of the advance starts at 2, per the contract terms. */
  number: number;
  claim: string;
  period: string;
  /** Gross value of work certified this period, ex-VAT. */
  subtotal: number;
  retention: number;
  advanceRecovery: number;
  vat: number;
  netPayable: number;
  status: "Paid" | "Approved";
  daysAgoIssued: number;
  /** Set only where the employer has recorded a receipt against the certificate. */
  daysAgoPaid?: number;
}

/**
 * Retention is 5% of each gross valuation (1,855,000 in total, comfortably
 * inside the 3% of contract cap). Advance recovery is 10% of each valuation
 * from IPC 2 — IPC 1 is the mobilisation certificate and never repays the
 * advance it paid for — against the 12,000,000 advance, of which 3,290,000
 * has now been recovered.
 */
const CERTIFICATES: CertificateSpec[] = [
  { number: 1, claim: "PC-2026-001", period: "2026-03", subtotal: 4_200_000, retention: 210_000, advanceRecovery: 0, vat: 315_000, netPayable: 4_305_000, status: "Paid", daysAgoIssued: 92, daysAgoPaid: 85 },
  { number: 2, claim: "PC-2026-002", period: "2026-04", subtotal: 8_500_000, retention: 425_000, advanceRecovery: 850_000, vat: 637_500, netPayable: 7_862_500, status: "Paid", daysAgoIssued: 70, daysAgoPaid: 62 },
  { number: 3, claim: "PC-2026-003", period: "2026-05", subtotal: 6_800_000, retention: 340_000, advanceRecovery: 680_000, vat: 510_000, netPayable: 6_290_000, status: "Paid", daysAgoIssued: 50, daysAgoPaid: 40 },
  { number: 4, claim: "PC-2026-004", period: "2026-06", subtotal: 12_200_000, retention: 610_000, advanceRecovery: 1_220_000, vat: 915_000, netPayable: 11_285_000, status: "Approved", daysAgoIssued: 28 },
  { number: 5, claim: "PC-2026-005", period: "2026-07", subtotal: 5_400_000, retention: 270_000, advanceRecovery: 540_000, vat: 405_000, netPayable: 4_995_000, status: "Approved", daysAgoIssued: 12 },
];

const CERT_LINES: Record<string, string> = {
  "PC-2026-001": "Interim valuation 1 — site strip and early substructure",
  "PC-2026-002": "Interim valuation 2 — substructure complete to DPC",
  "PC-2026-003": "Interim valuation 3 — columns cast, formwork struck",
  "PC-2026-004": "Interim valuation 4 — ground floor slab poured",
  "PC-2026-005": "Interim valuation 5 — first floor formwork",
};

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first<{ id: string }>("id");
  if (!project) return;

  const hasCol = (table: string, column: string) => knex.schema.hasColumn(table, column);
  // Direction is what makes a certificate a certificate; without the column
  // there is nothing here worth writing.
  if (!(await hasCol("project_invoices", "direction"))) return;

  const [hasContractLink, hasClaimLink, hasBillingPeriod, hasAdvance] = await Promise.all([
    hasCol("project_invoices", "contract_id"),
    hasCol("project_invoices", "payment_claim_id"),
    hasCol("project_invoices", "billing_period"),
    hasCol("project_invoices", "advance_recovery"),
  ]);

  const claims = await knex("payment_claims")
    .where({ project_id: PROJECT_ID })
    .select<Array<{ id: string; claim_number: string }>>("id", "claim_number");
  const claimId = new Map(claims.map((claim) => [claim.claim_number, claim.id]));

  const mainContract = hasContractLink
    ? await knex("project_contracts").where({ id: "fd_ct_main" }).first<{ id: string }>("id")
    : undefined;

  // Line items and payments cascade from the certificate, but the delete is
  // explicit so a re-run leaves nothing orphaned behind.
  await knex("invoice_payments").whereIn("invoice_id", CERT_IDS).del();
  await knex("project_invoice_line_items").whereIn("invoice_id", CERT_IDS).del();
  await knex("project_invoices").whereIn("id", CERT_IDS).del();

  for (const [index, cert] of CERTIFICATES.entries()) {
    const id = CERT_IDS[index]!;
    const number = `IPC-${String(cert.number).padStart(3, "0")}`;
    await knex("project_invoices").insert({
      id,
      project_id: PROJECT_ID,
      direction: "receivable",
      // The contractor issues the certificate; the employer is on the other
      // side of it. `vendor_name` is the legacy issuer field.
      vendor_name: CONTRACTOR,
      counterparty: EMPLOYER,
      trade: "Main contract — interim certification",
      number,
      invoice_type: "progress",
      status: cert.status,
      currency: "NGN",
      amount: money(cert.subtotal),
      subtotal: money(cert.subtotal),
      vat_rate: "7.5",
      vat_amount: money(cert.vat),
      // An IPC nets retention, advance recovery and VAT only; WHT is settled by
      // the employer outside the certificate, which is why `ipc-seeding.ts`
      // leaves it out of net payable.
      wht_rate: null,
      wht_amount: money(0),
      retention_rate: "5",
      retainage_percentage: "5",
      retention_amount: money(cert.retention),
      total_invoiced: money(cert.subtotal + cert.vat),
      net_payable: money(cert.netPayable),
      issue_date: isoDateDaysAgo(cert.daysAgoIssued),
      // 30 days, the payment terms already on the contract.
      due_date: isoDateDaysAgo(cert.daysAgoIssued - 30),
      notes: null,
      cc_emails: JSON.stringify([]),
      bcc_emails: JSON.stringify([]),
      ...(hasAdvance ? { advance_recovery: money(cert.advanceRecovery) } : {}),
      ...(hasBillingPeriod ? { billing_period: cert.period } : {}),
      ...(mainContract ? { contract_id: mainContract.id } : {}),
      ...(hasClaimLink && claimId.has(cert.claim) ? { payment_claim_id: claimId.get(cert.claim) } : {}),
      created_at: knex.fn.now(),
    });

    await knex("project_invoice_line_items").insert({
      id: `fd_ipcl${cert.number}`,
      invoice_id: id,
      position: 0,
      description: CERT_LINES[cert.claim] ?? `Interim valuation ${cert.number}`,
      quantity: money(1),
      unit: "valuation",
      unit_rate: money(cert.subtotal),
      amount: money(cert.subtotal),
      budget_category_id: null,
      is_variation: false,
      created_at: knex.fn.now(),
    });

    // The employer settled the gross certified value of each of the first three
    // valuations; retention is carried as its own Hold on `payment_ledger`
    // rather than netted off the receipt, which is how that ledger already
    // records it. A receipt, not a charge — the money moved at the bank.
    if (cert.daysAgoPaid !== undefined) {
      await knex("invoice_payments").insert({
        id: `fd_ipcpay${cert.number}`,
        invoice_id: id,
        amount: money(cert.subtotal),
        method: "Bank Transfer",
        paid_at: isoDateDaysAgo(cert.daysAgoPaid),
        note: `Receipt recorded against ${number}`,
        credit: false,
      });
    }

    // Close the billing chain the other way, so a claim names the certificate
    // it became instead of leaving the QS to match them by amount.
    if (claimId.has(cert.claim) && (await hasCol("payment_claims", "invoice_number"))) {
      await knex("payment_claims").where({ id: claimId.get(cert.claim)! }).update({
        invoice_number: number,
        invoice_amount: money(cert.subtotal),
        retention_amount: money(cert.retention),
        advance_recovery_amount: money(cert.advanceRecovery),
        vat_amount: money(cert.vat),
        invoice_recorded_at: knex.fn.now(),
        invoice_recorded_by: "seed-pm",
      });
    }
  }

  // Application #7 is the main contractor's own progress claim on the employer,
  // so it is receivable like the five above. It stays Draft — uncertified work
  // contributes nothing to the position — and the stage lines seeded in
  // `20260794b` still hang off it.
  await knex("project_invoices")
    .where({ project_id: PROJECT_ID, number: "PRG-INV-2026-002" })
    .update({ direction: "receivable", counterparty: EMPLOYER });

  // Reconcile the stored figures to what the certificates now derive, so the
  // finances row and the Finance overview stop telling two stories. Gross
  // certified is the sum of the five certificates (37,100,000, down from the
  // 45,100,000 that no document supported) and retention is the 5% held on it.
  // `amount_paid_to_date` already matches the receipts and is left alone.
  await knex("project_finances").where({ project_id: PROJECT_ID }).update({
    certified_gross_to_date: money(37_100_000),
    retention_held: money(1_855_000),
    advance_recovered: money(3_290_000),
  });
}

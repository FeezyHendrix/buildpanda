import { agentRepository } from "./repository.ts";
import { fn, round2, tool, type AgentTool } from "./tool-helpers.ts";
import { financesRepository } from "../../finances/repository.ts";
import { financeSummaryRepository } from "../../finances/summary-repository.ts";
import { invoiceCertificateRepository } from "../../invoices/certificate-repository.ts";
import { invoicesRepository } from "../../invoices/repository.ts";
import { invoicesService } from "../../invoices/service.ts";
import type { Invoice } from "../../invoices/types.ts";
import type { ToolContext } from "./tool-context.ts";

async function receivableCertificates(ctx: ToolContext) {
  return (await invoicesService(invoicesRepository(ctx.db)).listByProject(ctx.projectId))
    .filter((invoice) => invoice.direction === "receivable" && invoice.voidedAt === null);
}
const certified = (invoice: Invoice) => ["Approved", "Paid"].includes(invoice.workflowStatus);


export function contractTools(): AgentTool[] {
  return [
    tool(fn("get_payment_claims", "Get the project's payment claims (progress claims): claim number, workflow status (Draft/Submitted/Approved/Rejected/Paid), claimed and approved amounts, claim period and linked milestone. Use for questions about progress claims, what has been claimed or approved for payment."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const claims = await repo.paymentClaims(ctx.projectId);
      return {
        output: claims.map((c) => {
          const amount = Number(c.amount ?? 0);
          const approved = c.status === "Approved" || c.status === "Paid";
          return {
            id: c.id,
            claimNumber: c.claim_number,
            status: c.status,
            claimedAmount: amount,
            approvedAmount: approved ? amount : null,
            periodStart: c.period_start,
            periodEnd: c.period_end,
            submittedAt: c.submitted_at,
            approvedAt: c.approved_at,
            milestone: c.milestone_name ?? null,
          };
        }),
      };
    }),

    tool(fn("get_retention", "Read retention from the project's contract terms and receivable invoice certificates: agreed rate, release terms, certified amount held and each certificate's status and retention. Separate practical-completion and defects-liability cash release entries are not recorded in this register; do not invent release totals."), async (ctx) => {
      const [settings, totals, invoices] = await Promise.all([
        financesRepository(ctx.db).findSummary(ctx.projectId), financeSummaryRepository(ctx.db).certifiedTotals(ctx.projectId), receivableCertificates(ctx),
      ]);
      return { output: {
        currency: settings?.currency ?? null,
        retentionRatePct: settings ? round2(Number(settings.retention_rate) * 100) : null,
        retentionHeld: Number(totals.retention), releaseMode: settings?.retention_release_mode ?? null,
        certificates: invoices.filter((invoice) => invoice.retentionAmount !== 0).map((invoice) => ({
          id: invoice.id, number: invoice.number, status: invoice.status, workflowStatus: invoice.workflowStatus,
          retentionAmount: invoice.retentionAmount, countsTowardCertifiedRetention: certified(invoice), issueDate: invoice.issueDate,
        })),
      } };
    }),

    tool(fn("get_advance", "Read mobilization advance certificates, recorded receipts and recovery deductions from receivable invoices, with the contract's advance percentage and recovery rules. Certificate totals and proposed recoveries can include drafts; actualReceipts is money logged against advance certificates, and approvedRecovery comes only from approved certificates. Do not describe a draft invoice as cash paid."), async (ctx) => {
      const [settings, position, totals, invoices] = await Promise.all([
        financesRepository(ctx.db).findSummary(ctx.projectId), invoiceCertificateRepository(ctx.db).advancePosition(ctx.projectId),
        financeSummaryRepository(ctx.db).certifiedTotals(ctx.projectId), receivableCertificates(ctx),
      ]);
      return { output: {
        currency: settings?.currency ?? null, advanceCertificateTotal: Number(position.paid), recordedRecovery: Number(position.recovered),
        certificateBalance: round2(Number(position.paid) - Number(position.recovered)), approvedRecovery: Number(totals.advance_recovered),
        actualReceipts: round2(invoices.filter((invoice) => invoice.invoiceType === "advance").reduce((sum, invoice) => sum + invoice.amountPaid, 0)),
        advancePercentagePct: settings ? round2(Number(settings.advance_percentage) * 100) : null,
        recoveryMode: settings?.advance_recovery_mode ?? null, recoveryRatePct: settings ? round2(Number(settings.advance_recovery_rate) * 100) : null,
        certificates: invoices.filter((invoice) => invoice.invoiceType === "advance" || invoice.advanceRecovery !== 0).map((invoice) => ({
          id: invoice.id, number: invoice.number, type: invoice.invoiceType, status: invoice.status, workflowStatus: invoice.workflowStatus,
          subtotal: invoice.subtotal, amountPaid: invoice.amountPaid, advanceRecovery: invoice.advanceRecovery,
        })),
      } };
    }),

    tool(fn("get_measured_work", "Read measured quantities and unit rates from receivable progress, final and variation invoice line items. Each row keeps its source certificate and actual workflow status; approvedLineTotal excludes drafts, unapproved and voided certificates. These are recorded invoice valuations, not a separate measured-work register."), async (ctx) => {
      const invoices = (await receivableCertificates(ctx)).filter((invoice) => ["progress", "final", "variation"].includes(invoice.invoiceType));
      const records = invoices.flatMap((invoice) => invoice.lineItems.map((line) => ({
        certificateId: invoice.id, certificateNumber: invoice.number, lineId: line.id, description: line.description,
        unit: line.unit, quantity: line.quantity, unitRate: line.unitRate, amount: line.amount,
        status: invoice.status, workflowStatus: invoice.workflowStatus, issueDate: invoice.issueDate,
        countsTowardApprovedTotal: certified(invoice),
      })));
      return { output: { records, approvedLineTotal: round2(records.filter((row) => row.countsTowardApprovedTotal).reduce((sum, row) => sum + row.amount, 0)) } };
    }),
  ];
}

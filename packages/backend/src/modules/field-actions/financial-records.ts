import { suppliersService } from "../suppliers/service.ts";
import { suppliersRepository } from "../suppliers/repository.ts";
import { projectsRepository } from "../projects/repository.ts";
import { BadRequestError } from "../../lib/errors.ts";
import { buildTransactionsService } from "../transactions/wiring.ts";
import { buildPurchaseOrdersService } from "../purchase-orders/wiring.ts";
import type { CreatePurchaseOrderInput, ReceivePurchaseOrderInput } from "../purchase-orders/types.ts";
import { invoicesRepository } from "../invoices/repository.ts";
import { invoicesService } from "../invoices/service.ts";
import type { AddPaymentInput, CreateInvoiceInput } from "../invoices/types.ts";
import { buildInvoiceCertificateService } from "../invoices/wiring.ts";
import { invoiceNotifier } from "../invoices/invoice-notifier.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { financialEvidenceRepository } from "./financial-evidence-repository.ts";
import { financialSchemas } from "./financial-schemas.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import { requireSiteRecordReferences } from "./site-records-access.ts";
import type { FieldToolContext, FieldToolHandler } from "./tool-types.ts";

async function sameCurrency(context: FieldToolContext, supplied: unknown) {
  const project = await projectsRepository(context.db).currencyForShare(context.project.id);
  if (!project || supplied !== project.currency) throw new BadRequestError(`This project records costs in ${project?.currency ?? "its configured currency"}. Provide the amount in that currency; Panda cannot guess a conversion.`);
}

const financialHandler: FieldToolHandler = async (input, context) => {
  if (!context.db.isTransaction) return context.db.transaction((trx) => financialHandler(input, { ...context, db: trx }));
  const kind = input.kind as keyof typeof financialSchemas;
  const payload = validateFieldPayload<Record<string, unknown>>(financialSchemas[kind], input.payload);
  await requireSiteRecordReferences(context, payload);
  await context.requireFiles(payload);
  const { db, project, request, user } = context;
  if (payload.supplierId) {
    await request.requireProjectPermission(project.id, "materials", "view");
    await suppliersService(suppliersRepository(db)).get({ projectId: project.id, organizationId: project.organization_id }, payload.supplierId as string);
  }
  const evidence = financialEvidenceRepository(db);
  const fileId = payload.sourceFileId ?? payload.receiptFileId;
  await evidence.lock(project.id, typeof fileId === "string" ? await evidence.fingerprint(fileId) : String(payload.purchaseOrderId));
  if (kind === "attach_expense_receipt") {
    const service = buildTransactionsService(db, request, project);
    const expenseId = payload.expenseId as string, receiptFileId = payload.receiptFileId as string;
    if (await evidence.invoicePaymentForEvidence(context, receiptFileId)) throw new BadRequestError("This receipt already records an accessible invoice payment. Reconcile the records before attaching it to an expense.");
    await service.get(project.id, project.organization_id ?? project.owner_id ?? project.id, expenseId);
    await evidence.lockExpense(project.id, expenseId);
    const existing = await service.get(project.id, project.organization_id ?? project.owner_id ?? project.id, expenseId);
    if (!existing.receiptFileId && await evidence.duplicateExpense(context, { receiptFileId })) throw new BadRequestError("This receipt already belongs to another accessible expense. Review that expense instead.");
    if (existing.receiptFileId && existing.receiptFileId !== receiptFileId) throw new BadRequestError("This expense already has a receipt. Keep the original and add further evidence in Documents.");
    await service.edit(project.id, project.organization_id ?? project.owner_id ?? project.id, expenseId, { receiptFileId });
    return { kind, projectId: project.id, recordId: expenseId, message: "Receipt attached to the existing expense. No new expense recorded." };
  }
  if (kind === "create_purchase_order") {
    await sameCurrency(context, payload.currency);
    if (await evidence.duplicatePurchaseOrder(project.id, payload.sourceFileId as string)) throw new BadRequestError("This original already belongs to an accessible purchase order. Select that order instead of importing it twice.");
    const { currency: _currency, ...body } = payload;
    const record = await buildPurchaseOrdersService(db).create(project.id, body as unknown as CreatePurchaseOrderInput);
    return { kind, projectId: project.id, recordId: record.id, message: `Purchase order ${record.poNumber} saved as Draft. It has not been issued.`, data: { status: record.status, poNumber: record.poNumber } };
  }
  if (kind === "issue_purchase_order") {
    await evidence.lockPurchaseOrder(project.id, payload.purchaseOrderId as string);
    const record = await buildPurchaseOrdersService(db).issue(project.id, payload.purchaseOrderId as string, { issuedAt: payload.issuedAt as string }, user.id);
    return { kind, projectId: project.id, recordId: record.id, message: `Purchase order ${record.poNumber} issued. No payment recorded.` };
  }
  if (kind === "receive_purchase_order") {
    await evidence.lockPurchaseOrder(project.id, payload.purchaseOrderId as string);
    const { purchaseOrderId, ...body } = payload;
    const record = await buildPurchaseOrdersService(db).receive(project.id, purchaseOrderId as string, body as unknown as ReceivePurchaseOrderInput, user.id);
    return { kind, projectId: project.id, recordId: record.id, message: `Purchase order ${record.poNumber}: ${record.status}. Delivery evidence retained.` };
  }
  const repository = invoicesRepository(db);
  const service = invoicesService(repository);
  if (kind === "create_supplier_invoice") {
    // The bot cannot use an invoice import to bypass certification or create linked claims.
    if (payload.contractId || payload.poReferenceId || payload.paymentClaimId || payload.milestonePaymentId) throw new BadRequestError("Import the supplier invoice first. Review contract and claim links in the web app.");
    await sameCurrency(context, payload.currency);
    if (payload.number) await evidence.lock(project.id, `invoice:${String(payload.number).trim().toLowerCase()}`);
    const duplicate = await evidence.duplicateInvoice(project.id, payload);
    if (duplicate) throw new BadRequestError("An accessible invoice already uses this original or supplier reference. Select the existing invoice instead of importing it twice.");
    const record = await service.create(project.id, { ...payload, direction: "payable", invoiceType: "vendor", status: "Draft" } as unknown as CreateInvoiceInput);
    return { kind, projectId: project.id, recordId: record.id, message: "Supplier invoice saved as an unpaid Draft. No expense or payment recorded." };
  }
  const invoiceId = payload.invoiceId as string;
  await evidence.lockInvoice(project.id, invoiceId);
  const invoice = await service.get(project.id, invoiceId);
  if (invoice.direction === "payable") await request.requireProjectPermission(project.id, "finances", "viewCosts");
  if (payload.currency !== invoice.currency || payload.direction !== invoice.direction) throw new BadRequestError("The payment currency or direction differs from the selected invoice. Review the original and invoice again.");
  if (await evidence.duplicateExpense(context, { receiptFileId: payload.sourceFileId })) throw new BadRequestError("This payment evidence already belongs to an accessible expense. Reconcile that expense before recording an invoice payment.");
  if (await evidence.paymentExists(invoiceId, payload.sourceFileId as string)) throw new BadRequestError("This evidence already records a payment on the invoice. Review its payment history instead of recording it twice.");
  const { invoiceId: _id, currency: _currency, direction: _direction, ...body } = payload;
  const actor = { id: user.id, name: user.name };
  const record = await buildInvoiceCertificateService(db, context.queue).addPayment(project.id, invoiceId, body as unknown as AddPaymentInput, actor);
  if (record.paidLateDays !== null) {
    const row = await repository.findById(record.id);
    if (row) invoiceNotifier(notificationsService(notificationsRepository(db), context.queue), db).paidLate(project.id, row, record.paidLateDays, actor);
  }
  return { kind, projectId: project.id, recordId: record.id, message: "Invoice payment recorded with its evidence. No separate expense created.", data: { balanceDue: record.balanceDue } };
};
export const financialHandlers = Object.fromEntries(Object.keys(financialSchemas).map((kind) => [kind, financialHandler])) as Record<keyof typeof financialSchemas, FieldToolHandler>;

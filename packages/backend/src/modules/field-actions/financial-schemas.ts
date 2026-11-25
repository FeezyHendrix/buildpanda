import { createPurchaseOrderBody, issueBody, receiveBody } from "../purchase-orders/schemas.ts";
import { createInvoiceBody } from "../invoices/invoice-schemas.ts";
import { addPaymentBody } from "../invoices/payment-schemas.ts";
import type { FieldToolRequirement } from "./tool-types.ts";
const id = { type: "string", minLength: 1, maxLength: 100 } as const;
const currency = { type: "string", pattern: "^[A-Z]{3}$" } as const;

export const financialSchemas = {
  attach_expense_receipt: { type: "object", additionalProperties: false, required: ["expenseId", "receiptFileId"], properties: { expenseId: id, receiptFileId: id } },
  create_purchase_order: { ...createPurchaseOrderBody, required: [...createPurchaseOrderBody.required, "currency", "sourceFileId"], properties: {
    ...createPurchaseOrderBody.properties, currency, items: { ...createPurchaseOrderBody.properties.items, maxItems: 200,
      items: { ...createPurchaseOrderBody.properties.items.items, required: ["description", "quantity", "unitPrice"] } },
  } },
  issue_purchase_order: { ...issueBody, required: ["purchaseOrderId", "issuedAt"], properties: { ...issueBody.properties, purchaseOrderId: id } },
  receive_purchase_order: { ...receiveBody, required: [...receiveBody.required, "purchaseOrderId", "sourceFileId"], properties: { ...receiveBody.properties, purchaseOrderId: id, sourceFileId: id } },
  create_supplier_invoice: { ...createInvoiceBody, required: ["vendorName", "trade", "currency", "sourceFileId", "lineItems", "vatRate", "whtRate", "retentionRate"], properties: {
    ...createInvoiceBody.properties, direction: { type: "string", const: "payable" }, invoiceType: { type: "string", const: "vendor" }, status: { type: "string", const: "Draft" },
    lineItems: { ...createInvoiceBody.properties.lineItems, minItems: 1, maxItems: 200,
      items: { ...createInvoiceBody.properties.lineItems.items, required: ["description", "quantity", "unitRate"] } },
  } },
  record_invoice_payment: { ...addPaymentBody, required: ["invoiceId", "amount", "paidAt", "currency", "direction", "sourceFileId"], properties: {
    ...addPaymentBody.properties, invoiceId: id, currency, direction: { type: "string", enum: ["payable", "receivable"] },
  } },
};
export const financialRequirements = {
  attach_expense_receipt: { features: ["commercial.transactions"], permissions: [["finances", "manage"], ["finances", "viewCosts"]], readPermissions: [["finances", "viewCosts"]] },
  create_purchase_order: { features: ["commercial.purchaseOrders"], permissions: [["finances", "manage"], ["finances", "viewCosts"]], readPermissions: [["finances", "viewCosts"]] },
  issue_purchase_order: { features: ["commercial.purchaseOrders"], permissions: [["finances", "manage"], ["finances", "approve"], ["finances", "viewCosts"]], readPermissions: [["finances", "viewCosts"]] },
  receive_purchase_order: { features: ["commercial.purchaseOrders"], permissions: [["finances", "manage"], ["finances", "approve"], ["finances", "viewCosts"]], readPermissions: [["finances", "viewCosts"]] },
  create_supplier_invoice: { features: ["commercial.invoices"], permissions: [["finances", "manage"], ["finances", "view"], ["finances", "viewCosts"]], readPermissions: [["finances", "viewCosts"]] },
  record_invoice_payment: { features: ["commercial.invoices"], permissions: [["finances", "approve"], ["finances", "view"]], readPermissions: [["finances", "view"]] },
} as const satisfies Record<string, FieldToolRequirement>;
export const financialDefinitions = {
  attach_expense_receipt: { label: "Attach receipt to expense", description: "Attach original evidence to an accessible existing expense without recording another expense. Never replace an existing receipt." },
  create_purchase_order: { label: "Import purchase order draft", description: "Create a Draft supplier PO from the original document, preserving its number, supplier, explicit line quantities/rates and dates. Currency must match the project. This does not issue the order or receive goods." },
  issue_purchase_order: { label: "Issue purchase order", description: "Issue an existing authorized Draft PO only when explicitly requested in a separate review. Preserve actual issue date. This records a commitment, not a payment." },
  receive_purchase_order: { label: "Receive purchase order", description: "Record actual cumulative accepted quantities against actual PO line IDs. Ask what arrived and what was accepted, including partial delivery. Preserve original delivery evidence." },
  create_supplier_invoice: { label: "Import unpaid supplier invoice", description: "Import a supplier invoice as a payable Draft with the original evidence and explicit quantities, rates, currency and tax rates. Ask for missing values. This does not approve an invoice or record payment." },
  record_invoice_payment: { label: "Record invoice payment", description: "Record externally moved money against an existing approved invoice, preserving evidence, actual amount/date, direction and currency. Never infer bank verification. Does not create a second expense. Overpayment requires explicit acceptance and a reason." },
};

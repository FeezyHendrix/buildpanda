export type InvoiceDocumentKind = "invoice" | "receipt" | "quote" | "other";
export type InvoiceScanConfidence = "high" | "medium" | "low";

export interface ExtractedInvoiceParty {
  name: string | null;
  address: string | null;
  tin: string | null;
  firsNumber: string | null;
  email: string | null;
  bank: { accountName: string | null; accountNumber: string | null; bankName: string | null } | null;
}

export interface ExtractedInvoiceLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitRate: number | null;
  lineTotal: number | null;
}

export interface ExtractedInvoice {
  documentKind: InvoiceDocumentKind;
  confidence: InvoiceScanConfidence;
  vendorName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  lineItems: ExtractedInvoiceLineItem[];
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  whtRate: number | null;
  retentionRate: number | null;
  total: number | null;
  fromParty: ExtractedInvoiceParty | null;
  toParty: ExtractedInvoiceParty | null;
  notes: string | null;
}

export interface InvoiceScanResult {
  draft: ExtractedInvoice;
  sourceFileId: string;
  retryCount: number;
}

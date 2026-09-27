import api from "./client";

export const COMPLIANCE_DOC_TYPES = [
  "insurance_car",
  "insurance_public_liability",
  "performance_bond",
  "advance_payment_guarantee",
  "tax_clearance",
  "cac",
  "other",
] as const;
export type ComplianceDocType = (typeof COMPLIANCE_DOC_TYPES)[number];

export type ComplianceDocStatus = "valid" | "expiring" | "expired" | "no_expiry";

export interface ComplianceDoc {
  id: string;
  docType: ComplianceDocType;
  fileName: string;
  fileId: string | null;
  reference: string | null;
  notes: string | null;
  expiryDate: string | null;
  status: ComplianceDocStatus;
  daysUntilExpiry: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface CreateComplianceDocInput {
  fileId: string;
  docType: ComplianceDocType;
  reference?: string | null;
  notes?: string | null;
  expiryDate?: string | null;
}

export interface UpdateComplianceDocInput {
  docType?: ComplianceDocType;
  reference?: string | null;
  notes?: string | null;
  expiryDate?: string | null;
}

export const complianceDocsApi = {
  list: () => api.get<ComplianceDoc[]>("/org/compliance-docs").then((r) => r.data),
  create: (body: CreateComplianceDocInput) => api.post<ComplianceDoc>("/org/compliance-docs", body).then((r) => r.data),
  update: (docId: string, body: UpdateComplianceDocInput) =>
    api.patch<ComplianceDoc>(`/org/compliance-docs/${docId}`, body).then((r) => r.data),
  remove: (docId: string) => api.delete(`/org/compliance-docs/${docId}`).then((r) => r.data),
  viewUrl: (docId: string) => api.get<{ url: string }>(`/org/compliance-docs/${docId}/url`).then((r) => r.data.url),
};

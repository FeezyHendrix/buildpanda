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

export const COMPLIANCE_DOC_STATUSES = ["valid", "expiring", "expired", "no_expiry"] as const;
export type ComplianceDocStatus = (typeof COMPLIANCE_DOC_STATUSES)[number];

export const COMPLIANCE_EXPIRING_WINDOW_DAYS = 30;

export interface ComplianceDocRow {
  id: string;
  org_id: string;
  file_name: string;
  storage_path: string;
  file_id: string | null;
  doc_type: ComplianceDocType;
  reference: string | null;
  notes: string | null;
  expiry_date: Date | string | null;
  uploaded_by: string | null;
  expiring_notified_at: Date | null;
  expired_notified_at: Date | null;
  created_at: Date;
}

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

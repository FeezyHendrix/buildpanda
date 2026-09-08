import type { BadgeTone } from "@/components/atoms/badge";
import type { ComplianceDocStatus, ComplianceDocType } from "@/api/compliance-docs";

export const COMPLIANCE_DOC_TYPE_LABEL: Record<ComplianceDocType, string> = {
  insurance_car: "Contractor's all-risk insurance",
  insurance_public_liability: "Public liability insurance",
  performance_bond: "Performance bond",
  advance_payment_guarantee: "Advance payment guarantee",
  tax_clearance: "Tax clearance certificate",
  cac: "CAC registration",
  other: "Other",
};

export const COMPLIANCE_STATUS_META: Record<ComplianceDocStatus, { label: string; tone: BadgeTone }> = {
  valid: { label: "Valid", tone: "success" },
  expiring: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  no_expiry: { label: "No expiry", tone: "neutral" },
};

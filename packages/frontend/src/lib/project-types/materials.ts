

export type LedgerEntryType = "IN" | "USED" | "VOID";
export type LedgerEntryStatus = "Posted" | "Voided";

export interface MaterialCatalogItem {
  id: string;
  projectId: string;
  name: string;
  unit: string;
  lowStockThreshold: number | null;
  active: boolean;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  preferredSupplierId: string | null;
  preferredSupplierName: string | null;
  autoReorderEnabled: boolean;
}

export interface ReorderPolicyInput {
  lowStockThreshold?: number | null;
  reorderQuantity?: number | null;
  leadTimeDays?: number | null;
  preferredSupplierId?: string | null;
  autoReorderEnabled?: boolean;
}

export interface LedgerEntryFile {
  fileId: string;
  url: string;
  name: string;
}

export interface LedgerEntry {
  id: string;
  projectId: string;
  entryType: LedgerEntryType;
  status: LedgerEntryStatus;
  materialId: string;
  materialName: string;
  unit: string;
  locationKey: string;
  stageId: string | null;
  stageName: string | null;
  approvalStatus: string;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  quantity: number;
  stockDelta: number;
  occurredAt: string;
  timestampSuspect: boolean;
  negativeStock: boolean;
  loggedById: string | null;
  loggedByName: string | null;
  materialOrderId: string | null;
  /** The order a receipt arrived against; a receipt without one is an unplanned delivery. */
  materialOrderTitle: string | null;
  taskId: string | null;
  activityId: string | null;
  reversalForEntryId: string | null;
  reason: string | null;
  notesHtml: string | null;
  /** Who the goods came from, snapshotted on the receipt. */
  supplier: string | null;
  /** Delivery-note number the receipt was signed on. */
  deliveryNote: string | null;
  /** Approved by the same person who logged it — maker/checker breached. */
  selfApproved: boolean;
  files: LedgerEntryFile[];
  createdAt: string;
}

export interface StockLevel {
  materialId: string;
  materialName: string;
  unit: string;
  locationKey: string;
  onHandQty: number;
  totalReceived: number;
  totalUsed: number;
  lowStockThreshold: number | null;
  lowStock: boolean;
}

/** "project" = raised on this job; "organization" = on the company register. */
export type SupplierScope = "project" | "organization";

export interface Supplier {
  id: string;
  projectId: string | null;
  organizationId: string | null;
  scope: SupplierScope;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  trade: string | null;
  approved: boolean;
  leadTimeDays: number | null;
  paymentTerms: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

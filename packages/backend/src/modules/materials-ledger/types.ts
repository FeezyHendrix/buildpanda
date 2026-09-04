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
  quantity: number;
  stockDelta: number;
  occurredAt: string;
  timestampSuspect: boolean;
  negativeStock: boolean;
  loggedById: string | null;
  loggedByName: string | null;
  materialOrderId: string | null;
  taskId: string | null;
  activityId: string | null;
  reversalForEntryId: string | null;
  reason: string | null;
  notesHtml: string | null;
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

export interface MaterialCatalogRow {
  id: string;
  project_id: string;
  name: string;
  normalized_name: string;
  unit: string;
  low_stock_threshold: string | null;
  active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  reorder_quantity: string | null;
  lead_time_days: number | null;
  preferred_supplier_id: string | null;
  preferred_supplier_name: string | null;
  auto_reorder_enabled: boolean;
}

export interface LedgerEntryRow {
  id: string;
  project_id: string;
  idempotency_key: string;
  entry_type: LedgerEntryType;
  status: LedgerEntryStatus;
  material_id: string;
  material_name_snapshot: string;
  unit_snapshot: string;
  location_key: string;
  stage_id: string | null;
  quantity: string;
  stock_delta: string;
  occurred_at: string;
  timestamp_suspect: boolean;
  negative_stock: boolean;
  logged_by_id: string | null;
  logged_by_name: string | null;
  material_order_id: string | null;
  task_id: string | null;
  activity_id: string | null;
  reversal_for_entry_id: string | null;
  reason: string | null;
  notes_html: string | null;
  created_at: string;
}

export interface LedgerEntryFileRow {
  entry_id: string;
  file_id: string;
  purpose: string;
}

export interface StockRow {
  project_id: string;
  material_id: string;
  material_name: string;
  unit: string;
  location_key: string;
  on_hand_qty: string;
  low_stock_threshold: string | null;
  total_received: string;
  total_used: string;
}

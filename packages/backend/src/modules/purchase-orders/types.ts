export const PURCHASE_ORDER_STATUSES = [
  "Draft",
  "Issued",
  "PartiallyReceived",
  "Received",
  "Closed",
  "Cancelled",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

/** A PO counts as committed spend once it has been issued to the vendor. */
export const COMMITTED_PURCHASE_ORDER_STATUSES = [
  "Issued",
  "PartiallyReceived",
  "Received",
  "Closed",
] as const satisfies readonly PurchaseOrderStatus[];

export interface PurchaseOrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  status: PurchaseOrderStatus;
  orderDate: string | null;
  expectedDate: string | null;
  notes: string | null;
  stageId: string | null;
  stageName: string | null;
  total: number;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderRow {
  id: string;
  project_id: string;
  po_number: string;
  vendor_name: string;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_date: string | null;
  notes: string | null;
  stage_id: string | null;
  created_at: Date | string;
}

export interface PurchaseOrderRowWithStage extends PurchaseOrderRow {
  stage_name: string | null;
}

export interface PurchaseOrderItemRow {
  id: string;
  purchase_order_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  created_at: Date | string;
}

export interface PurchaseOrderItemInput {
  description: string;
  quantity?: number;
  unitPrice?: number;
}

export interface CreatePurchaseOrderInput {
  poNumber: string;
  vendorName: string;
  status?: PurchaseOrderStatus;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  stageId?: string | null;
  items: PurchaseOrderItemInput[];
}

export interface EditPurchaseOrderInput {
  poNumber?: string;
  vendorName?: string;
  status?: PurchaseOrderStatus;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  stageId?: string | null;
  items: PurchaseOrderItemInput[];
}

/** Σ(quantity × unit_price) of committed POs per stage; `stage_id` is never null here. */
export interface StageCommittedSumRow {
  stage_id: string;
  total: string;
}

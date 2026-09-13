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

/** Once goods are received the order is a record of what arrived, not a draft. */
export const LINES_LOCKED_STATUSES = [
  "PartiallyReceived",
  "Received",
  "Closed",
  "Cancelled",
] as const satisfies readonly PurchaseOrderStatus[];

export interface PurchaseOrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  receivedQuantity: number;
  outstandingQuantity: number;
  overReceived: boolean;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  supplierId: string | null;
  materialOrderId: string | null;
  status: PurchaseOrderStatus;
  orderDate: string | null;
  expectedDate: string | null;
  issuedAt: string | null;
  issuedById: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  closedAt: string | null;
  overReceipt: boolean;
  /** Whether this order's value counts toward committed spend. */
  committed: boolean;
  notes: string | null;
  stageId: string | null;
  stageName: string | null;
  total: number;
  receivedTotal: number;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderRow {
  id: string;
  project_id: string;
  po_number: string;
  vendor_name: string;
  supplier_id: string | null;
  material_order_id: string | null;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_date: string | null;
  issued_at: string | null;
  issued_by_id: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  closed_at: string | null;
  over_receipt: boolean;
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
  received_quantity: string;
  created_at: Date | string;
}

export interface PurchaseOrderItemInput {
  description: string;
  quantity?: number;
  unitPrice?: number;
}

export interface CreatePurchaseOrderInput {
  /** Left blank, the project's next PO-<n> is allocated. */
  poNumber?: string;
  vendorName: string;
  supplierId?: string | null;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  stageId?: string | null;
  items: PurchaseOrderItemInput[];
}

export interface EditPurchaseOrderInput {
  poNumber?: string;
  vendorName?: string;
  supplierId?: string | null;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  stageId?: string | null;
  items: PurchaseOrderItemInput[];
}

export interface ReceiveLineInput {
  itemId: string;
  receivedQuantity: number;
}

export interface ReceivePurchaseOrderInput {
  lines: ReceiveLineInput[];
  receivedAt?: string;
  note?: string;
}

export interface CancelPurchaseOrderInput {
  reason: string;
}

export interface IssuePurchaseOrderInput {
  issuedAt?: string;
}

/** Raising a PO from an approved material request, carrying its detail over. */
export interface RaiseFromMaterialOrderInput {
  poNumber?: string | null;
  expectedDate?: string | null;
  notes?: string | null;
}

export interface MaterialOrderSource {
  id: string;
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitRate: number | null;
  estimatedCost: number;
  supplier: string | null;
  supplierId: string | null;
  phaseId: string | null;
  expectedDeliveryAt: string | null;
  neededBy: string;
}

/** Σ(quantity × unit_price) of committed POs per stage; `stage_id` is never null here. */
export interface StageCommittedSumRow {
  stage_id: string;
  total: string;
}

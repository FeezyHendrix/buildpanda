export const PURCHASE_ORDER_STATUSES = [
  "Draft",
  "Issued",
  "PartiallyReceived",
  "Received",
  "Closed",
  "Cancelled",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

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
  created_at: Date | string;
}

export interface PurchaseOrderItemRow {
  id: string;
  purchase_order_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  created_at: Date | string;
}

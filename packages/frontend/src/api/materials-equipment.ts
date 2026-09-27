import api from "./client";
import type {
  EquipmentBucket,
  EquipmentRequest,
  EquipmentRequestStatus,
  MaterialDelivery,
  MaterialOrder,
  MaterialOrderStatus,
  RequestPriority,
} from "@/lib/project-types";

export interface MaterialOrderInput {
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier?: string | null;
  /** The supplier register is the reference now; `supplier` is only a fallback. */
  supplierId?: string | null;
  unitRate?: number | null;
  status?: MaterialOrderStatus;
  priority?: RequestPriority;
  phaseId?: string | null;
  activityId?: string | null;
  documentId?: string | null;
  neededBy: string;
  orderedAt?: string | null;
  expectedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  estimatedCost?: number;
  actualCost?: number;
  currency?: "NGN" | "USD";
  deliveryLocation?: string | null;
  notes?: string | null;
}

/**
 * Everything a PATCH may carry beyond the create fields. `reason` is required
 * by the server when moving to Cancelled or Rejected; `force`/`forceNote` are
 * the "order it anyway" path when the material's approval is not in hand.
 */
export interface MaterialOrderPatch extends Partial<MaterialOrderInput> {
  reason?: string | null;
  force?: boolean;
  forceNote?: string | null;
}

export interface RecordDeliveryInput {
  deliveredQty: number;
  deliveredAt: string;
  deliveryNote?: string | null;
  receivedById?: string | null;
  notes?: string | null;
  rejected?: boolean;
  rejectedReason?: string | null;
}

export interface ExtendHireInput {
  offHireAt: string;
  reason?: string | null;
}

export interface EquipmentRequestPatch extends Partial<EquipmentRequestInput> {
  reason?: string | null;
}

export interface EquipmentRequestInput {
  title: string;
  equipmentName: string;
  equipmentType: string;
  quantity?: number;
  supplier?: string | null;
  supplierId?: string | null;
  onHireAt?: string | null;
  offHireAt?: string | null;
  plantRef?: string | null;
  dailyRate?: number | null;
  status?: EquipmentRequestStatus;
  priority?: RequestPriority;
  phaseId?: string | null;
  activityId?: string | null;
  documentId?: string | null;
  neededFrom: string;
  neededUntil: string;
  mobilizedAt?: string | null;
  returnedAt?: string | null;
  estimatedCost?: number;
  actualCost?: number;
  currency?: "NGN" | "USD";
  deliveryLocation?: string | null;
  operatorRequired?: boolean;
  notes?: string | null;
}

export interface ParsedBoqMaterial {
  materialName: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  supplier: string | null;
}

export interface BoqMaterialOption {
  materialName: string;
  unit: string;
  estimatedCost: number;
  supplier: string | null;
}

export type BoqJobStatus = "pending" | "processing" | "completed" | "failed";

export interface BoqImportJob {
  id: string;
  status: BoqJobStatus;
  fileName: string;
  materials: ParsedBoqMaterial[];
  materialCount: number;
  usedAi: boolean;
  error: string | null;
}

export const materialsEquipmentApi = {
  listMaterialOrders: (projectId: string, status?: MaterialOrderStatus) =>
    api.get<MaterialOrder[]>(`/projects/${projectId}/materials/orders`, { params: status ? { status } : undefined }).then(r => r.data),
    
  createMaterialOrder: (projectId: string, body: MaterialOrderInput) =>
    api.post<MaterialOrder>(`/projects/${projectId}/materials/orders`, body).then(r => r.data),
    
  startBoqImport: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<BoqImportJob>(`/projects/${projectId}/materials/import`, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 0 }).then(r => r.data);
  },
  
  getBoqImportJob: (projectId: string, jobId: string) =>
    api.get<BoqImportJob>(`/projects/${projectId}/materials/import/${jobId}`).then(r => r.data),

  listBoqMaterials: (projectId: string) =>
    api.get<BoqMaterialOption[]>(`/projects/${projectId}/materials/boq-materials`).then(r => r.data),
    
  bulkCreateMaterials: (projectId: string, materials: ParsedBoqMaterial[]) =>
    api.post<{ created: number; budgetCategories?: { created: number; skipped: number } }>(`/projects/${projectId}/materials/bulk`, { materials }).then(r => r.data),
    
  getMaterialOrder: (projectId: string, orderId: string) =>
    api.get<MaterialOrder>(`/projects/${projectId}/materials/orders/${orderId}`).then(r => r.data),

  updateMaterialOrder: (projectId: string, orderId: string, body: MaterialOrderPatch) =>
    api.patch<MaterialOrder>(`/projects/${projectId}/materials/orders/${orderId}`, body).then(r => r.data),

  deleteMaterialOrder: (projectId: string, orderId: string) =>
    api.delete(`/projects/${projectId}/materials/orders/${orderId}`).then(r => r.data),

  listDeliveries: (projectId: string, orderId: string) =>
    api
      .get<MaterialDelivery[]>(`/projects/${projectId}/materials/orders/${orderId}/deliveries`)
      .then(r => r.data),

  // Recording a delivery is what books stock and books cost — the order's
  // status follows from the quantities, so the response is the whole order.
  recordDelivery: (projectId: string, orderId: string, body: RecordDeliveryInput) =>
    api
      .post<MaterialOrder>(`/projects/${projectId}/materials/orders/${orderId}/deliveries`, body)
      .then(r => r.data),

  listEquipmentRequests: (projectId: string, bucket?: EquipmentBucket) =>
    api.get<EquipmentRequest[]>(`/projects/${projectId}/equipment-requests`, { params: bucket ? { bucket } : undefined }).then(r => r.data),
    
  createEquipmentRequest: (projectId: string, body: EquipmentRequestInput) =>
    api.post<EquipmentRequest>(`/projects/${projectId}/equipment-requests`, body).then(r => r.data),
    
  updateEquipmentRequest: (projectId: string, requestId: string, body: EquipmentRequestPatch) =>
    api.patch<EquipmentRequest>(`/projects/${projectId}/equipment-requests/${requestId}`, body).then(r => r.data),

  // A hire extension is a variation on the hire order, not an edit of a date:
  // the server keeps the original off-hire in `extensions`.
  extendHire: (projectId: string, requestId: string, body: ExtendHireInput) =>
    api
      .post<EquipmentRequest>(`/projects/${projectId}/equipment-requests/${requestId}/extend`, body)
      .then(r => r.data),

  deleteEquipmentRequest: (projectId: string, requestId: string) =>
    api.delete(`/projects/${projectId}/equipment-requests/${requestId}`).then(r => r.data),
};

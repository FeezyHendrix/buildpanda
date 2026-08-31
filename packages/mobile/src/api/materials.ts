import { request } from "./client";

export interface MaterialOrder {
  id: string;
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier: string | null;
  status: string;
}

export interface CreateMaterialOrderInput {
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier?: string | null;
}

export const materialsApi = {
  list: (projectId: string) =>
    request<MaterialOrder[]>(`/projects/${projectId}/materials/orders`),

  detail: (projectId: string, orderId: string) =>
    request<MaterialOrder>(`/projects/${projectId}/materials/orders/${orderId}`),

  create: (projectId: string, body: CreateMaterialOrderInput) =>
    request<MaterialOrder>(`/projects/${projectId}/materials/orders`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (projectId: string, orderId: string, body: Partial<CreateMaterialOrderInput>) =>
    request<MaterialOrder>(`/projects/${projectId}/materials/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  remove: (projectId: string, orderId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/materials/orders/${orderId}`, {
      method: "DELETE",
    }),
};

import api from "./client";
import type { PreconBill } from "./precon-types";
import type { CreateRowInput, PreconBoqRow, UpdateRowInput } from "./precon-row-types";

// The bill and the lines in it. Spread into `preconApi`, so every existing
// `preconApi.updateRow(...)` call keeps working unchanged.
export const preconRowsApi = {
  createBill: (sessionId: string, title: string) =>
    api.post<PreconBill>(`/precon/sessions/${sessionId}/bills`, { title }).then((r) => r.data),

  renameBill: (billId: string, title: string) =>
    api.patch<PreconBill>(`/precon/bills/${billId}`, { title }).then((r) => r.data),

  deleteBill: (billId: string) => api.delete(`/precon/bills/${billId}`).then((r) => r.data),

  createRow: (billId: string, input: CreateRowInput) =>
    api.post<PreconBoqRow>(`/precon/bills/${billId}/rows`, input).then((r) => r.data),

  deleteRow: (rowId: string) => api.delete(`/precon/rows/${rowId}`).then((r) => r.data),

  updateRow: (rowId: string, input: UpdateRowInput) =>
    api.patch<PreconBoqRow>(`/precon/rows/${rowId}`, input).then((r) => r.data),

  verifyRow: (rowId: string, version: number) =>
    api.post<PreconBoqRow>(`/precon/rows/${rowId}/verify`, { version }).then((r) => r.data),

  rejectRow: (rowId: string, version: number) =>
    api.post<PreconBoqRow>(`/precon/rows/${rowId}/reject`, { version }).then((r) => r.data),
};

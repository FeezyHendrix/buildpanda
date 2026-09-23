import api from "./client";
import type {
  CreateMeasurementBody,
  CreateMeasurementResult,
  PreconBoqRow,
  PreconGeometryKind,
} from "./precon-row-types";

// Everything that writes a shape: re-measuring a line, taking a deduction off
// it, and the line drawn by hand. Spread into `preconApi`, so every existing
// `preconApi.updateGeometry(...)` call keeps working unchanged.
export const preconGeometryApi = {
  updateGeometry: (
    rowId: string,
    input: { version: number; kind: PreconGeometryKind; vertices: number[][]; sheetId?: string },
  ) => api.put<PreconBoqRow>(`/precon/rows/${rowId}/geometry`, input).then((r) => r.data),

  addDeduction: (
    rowId: string,
    input: { version: number; label: string; vertices: number[][]; sheetId?: string },
  ) => api.post<PreconBoqRow>(`/precon/rows/${rowId}/deductions`, input).then((r) => r.data),

  /** WS-M1B: a line drawn by hand becomes a verified manual bill row with its geometry. */
  createMeasurement: (sessionId: string, body: CreateMeasurementBody) =>
    api.post<CreateMeasurementResult>(`/precon/sessions/${sessionId}/measurements`, body).then((r) => r.data),
};

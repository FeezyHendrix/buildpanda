export const TAKEOFF_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type TakeoffStatus = (typeof TAKEOFF_STATUSES)[number];

export interface DrawingSummary {
  id: number;
  kind: string;
  widthM: number;
  heightM: number;
  entityCount: number;
}

export interface MeasuredItem {
  trade: string;
  description: string;
  quantity: number;
  unit: string;
  confidence: "high" | "medium" | "low";
  basis: string;
}

export interface TakeoffResult {
  scaleToMm: number;
  scaleConfidence: number;
  drawings: DrawingSummary[];
  selectedDrawingId: number | null;
  items: MeasuredItem[];
  notes: string[];
}

export interface TakeoffJobRow {
  id: string;
  project_id: string | null;
  proposal_id: string | null;
  file_id: string | null;
  status: TakeoffStatus;
  file_name: string;
  storage_path: string;
  result: TakeoffResult | string | null;
  drawing_count: number;
  element_count: number;
  error: string | null;
  requested_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TakeoffJob {
  id: string;
  projectId: string | null;
  proposalId: string | null;
  fileId: string | null;
  status: TakeoffStatus;
  fileName: string;
  result: TakeoffResult | null;
  drawingCount: number;
  elementCount: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

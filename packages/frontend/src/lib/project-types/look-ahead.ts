import type { MaterialOrderStatus } from "./procurement";

export interface AutoWindowMaterialOrder {
  id: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier: string | null;
  status: MaterialOrderStatus;
  neededBy: string;
}

export interface AutoWindowActivity {
  activityId: string;
  activityName: string;
  phaseName: string | null;
  status: string;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned: number;
  fromProgramme: boolean;
  materialOrders: AutoWindowMaterialOrder[];
  hasMaterialCoverage: boolean;
}

export interface AutoWindowResult {
  weeks: number;
  from: string;
  to: string;
  activities: AutoWindowActivity[];
}

export const LOOK_AHEAD_STATUSES = ["Draft", "UnderReview", "Approved"] as const;
export type LookAheadStatus = (typeof LOOK_AHEAD_STATUSES)[number];
export type LookAheadTimeline = "past" | "current" | "future";

export interface LookAheadActivitySummary {
  activityId: string;
  name: string;
  status: string;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned: number;
}

export interface LookAhead {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: LookAheadStatus;
  startDate: string;
  endDate: string;
  totalWorkers: number | null;
  activities: LookAheadActivitySummary[];
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLookAheadInput {
  name: string;
  description?: string | null;
  status?: LookAheadStatus;
  startDate: string;
  endDate: string;
  totalWorkers?: number | null;
  activityIds?: string[];
}

export interface UpdateLookAheadInput {
  name?: string;
  description?: string | null;
  status?: LookAheadStatus;
  startDate?: string;
  endDate?: string;
  totalWorkers?: number | null;
  assignActivityIds?: string[];
  unassignActivityIds?: string[];
}

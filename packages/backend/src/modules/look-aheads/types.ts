export const LOOK_AHEAD_STATUSES = ["Draft", "UnderReview", "Approved"] as const;
export type LookAheadStatus = (typeof LOOK_AHEAD_STATUSES)[number];

export type LookAheadTimeline = "past" | "current" | "future";

export interface LookAheadRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: LookAheadStatus;
  start_date: string;
  end_date: string;
  total_workers: number | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LookAheadActivityRow {
  look_ahead_id: string;
  activity_id: string;
  name: string;
  status: string;
  planned_start_at: string;
  planned_end_at: string;
  worker_count_planned: number;
}

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

export interface LookAheadListFilters {
  status?: LookAheadStatus;
  timeline?: LookAheadTimeline;
  activityId?: string;
  sort?: "startDate" | "endDate" | "status";
  order?: "asc" | "desc";
}

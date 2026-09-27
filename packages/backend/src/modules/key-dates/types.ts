export const KEY_DATE_STATUSES = ["Upcoming", "Met", "Missed"] as const;
export type KeyDateStatus = (typeof KEY_DATE_STATUSES)[number];

export interface KeyDate {
  buildingId: string;
  id: string;
  projectId: string;
  label: string;
  targetDate: string | null;
  actualDate: string | null;
  status: KeyDateStatus;
  notes: string | null;
  /** The activity that delivers this date; a delay on it carries the date with it. */
  linkedActivityId: string | null;
  /**
   * A contract date (Practical Completion, sectional completion, defects
   * liability end). Contractual dates carry liquidated-damages consequences and
   * never drift with the programme — only an awarded EOT moves them.
   */
  isContractual: boolean;
  /** The date originally programmed, stamped the first time the date is revised. */
  revisedFrom: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface KeyDateRow {
  id: string;
  project_id: string;
  building_id: string;
  label: string;
  target_date: string | null;
  actual_date: string | null;
  status: KeyDateStatus;
  notes: string | null;
  linked_activity_id: string | null;
  is_contractual: boolean;
  revised_from: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface KeyDateInput {
  label?: string;
  buildingId?: string | null;
  targetDate?: string | null;
  actualDate?: string | null;
  status?: KeyDateStatus;
  notes?: string | null;
  linkedActivityId?: string | null;
  isContractual?: boolean;
}

export interface KeyDatePatch {
  label?: string;
  target_date?: string | null;
  actual_date?: string | null;
  status?: KeyDateStatus;
  notes?: string | null;
  linked_activity_id?: string | null;
  is_contractual?: boolean;
  revised_from?: string | null;
}

export interface NewKeyDateRecord {
  id: string;
  project_id: string;
  building_id: string;
  label: string;
  target_date: string | null;
  actual_date: string | null;
  status: KeyDateStatus;
  notes: string | null;
  linked_activity_id: string | null;
  is_contractual: boolean;
}

/** One activity the programme moved, and by how many working days. */
export interface KeyDateActivityMove {
  id: string;
  days: number;
}

/**
 * What else in the project points at an activity. Deleting an activity that an
 * approved look-ahead or an open delay references quietly rewrote a signed-off
 * plan (finding F30), so the UI asks for this before it offers Delete.
 */

export interface ActivityLookAheadReferenceRow {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
}

export interface ActivityDelayReferenceRow {
  id: string;
  reason_code: string;
  started_at: Date | string;
  resolved_at: Date | string | null;
}

export interface ActivityLookAheadReference {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface ActivityDelayReference {
  id: string;
  reasonCode: string;
  startedAt: string;
  resolved: boolean;
}

export interface ActivityReferences {
  activityId: string;
  lookAheads: ActivityLookAheadReference[];
  /** True when at least one look-ahead referencing it is Approved. */
  blockedByApprovedLookAhead: boolean;
  delays: ActivityDelayReference[];
  openDelayCount: number;
}

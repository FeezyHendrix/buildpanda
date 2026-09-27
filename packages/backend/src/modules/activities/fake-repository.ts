import type { ActivitiesRepository, NewActivityEventRecord } from "./repository.ts";
import type { ActivityDelayRow, ActivityRow, DelayReasonRow } from "./types.ts";

/**
 * Hand-written in-memory stand-in for the activities repository, shared by the
 * cascade, delay and service tests. Only the reads and writes those paths use
 * are implemented; everything else throws so a missing case is obvious.
 */
export interface FakeStore {
  activities: ActivityRow[];
  delays: ActivityDelayRow[];
  reasons: DelayReasonRow[];
  events: NewActivityEventRecord[];
}

export function activityRow(over: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: "act_1",
    project_id: "prj_1",
    building_id: "bld_1",
    phase_id: null,
    name: "Plant mobilisation",
    activity_type: "works",
    location: null,
    status: "Planned",
    planned_start_at: "2026-09-07T07:00:00.000Z",
    planned_end_at: "2026-09-14T17:00:00.000Z",
    actual_start_at: null,
    actual_end_at: null,
    worker_count_planned: 0,
    assignee_id: null,
    notes: null,
    wbs_code: null,
    outline_level: null,
    parent_activity_id: null,
    predecessors: [],
    percent_complete: 0,
    duration_days: null,
    baseline_start_at: null,
    baseline_end_at: null,
    is_milestone: false,
    source: "manual",
    created_by_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

export function delayRow(over: Partial<ActivityDelayRow> = {}): ActivityDelayRow {
  return {
    id: "delay_1",
    activity_id: "act_1",
    reason_code: "WEATHER_RAIN",
    description: null,
    description_html: null,
    started_at: "2026-09-10T05:00:00.000Z",
    ended_at: null,
    days_lost: 0,
    culpability: "neutral",
    eot_claimable: true,
    linked_rfi_id: null,
    linked_change_request_id: null,
    linked_material_order_id: null,
    applied_shift_days: 0,
    resolved_at: null,
    resolved_by_id: null,
    cost_impact: "0",
    currency: "NGN",
    prevention_notes: null,
    recorded_by_id: "usr_1",
    created_at: "2026-09-10T06:00:00.000Z",
    ...over,
  };
}

export const RAIN: DelayReasonRow = {
  code: "WEATHER_RAIN",
  category: "Weather",
  name: "Rain",
  default_culpability: "neutral",
  default_eot_claimable: true,
};

export const DELIVERY: DelayReasonRow = {
  code: "MATERIAL_DELIVERY",
  category: "Material",
  name: "Delivery Delay",
  default_culpability: "contractor",
  default_eot_claimable: false,
};

export function fakeRepository(store: FakeStore): ActivitiesRepository {
  const repo = {
    listByProject: async (projectId: string) =>
      store.activities.filter((a) => a.project_id === projectId),
    findById: async (id: string) => store.activities.find((a) => a.id === id),
    update: async (id: string, patch: Record<string, unknown>) => {
      const row = store.activities.find((a) => a.id === id);
      if (!row) return undefined;
      Object.assign(row, patch);
      return row;
    },
    create: async (record: Record<string, unknown>) => {
      const row = activityRow(record as Partial<ActivityRow>);
      store.activities.push(row);
      return row;
    },
    recordEvent: async (record: NewActivityEventRecord) => {
      store.events.push(record);
    },
    delaysForActivity: async (activityId: string) =>
      store.delays.filter((d) => d.activity_id === activityId),
    delaysForActivities: async (ids: string[]) =>
      store.delays.filter((d) => ids.includes(d.activity_id)),
    findDelayById: async (id: string) => store.delays.find((d) => d.id === id),
    findReasonByCode: async (code: string) => store.reasons.find((r) => r.code === code),
    reasonsByCodes: async (codes: string[]) => store.reasons.filter((r) => codes.includes(r.code)),
    createDelay: async (record: Record<string, unknown>) => {
      const row = delayRow(record as Partial<ActivityDelayRow>);
      store.delays.push(row);
      return row;
    },
    resolveDelay: async (id: string, patch: Record<string, unknown>) => {
      const row = store.delays.find((d) => d.id === id);
      if (!row) return undefined;
      Object.assign(row, patch);
      return row;
    },
    phaseNamesForProject: async () => [],
    countByPhase: async (phaseId: string) =>
      store.activities.filter((a) => a.phase_id === phaseId).length,
  };
  return repo as unknown as ActivitiesRepository;
}

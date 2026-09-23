// Turning an accepted proposal into a live project, as types.
//
// Split from `types.ts` at the house 400-line ceiling. Conversion is its own
// act with its own vocabulary — which sections carry over, what the preview
// says each will produce, and the seeds the project is built from — and nothing
// outside that flow names any of it. `types.ts` re-exports the lot, so no
// importer had to move.

export const CONVERT_SECTIONS = [
  "programme",
  "milestones",
  "budget",
  "materials",
  "drawings",
  "documents",
  "permits",
  "selections",
  "safety",
  "client",
] as const;
export type ConvertSection = (typeof CONVERT_SECTIONS)[number];
export type ConvertInclude = Partial<Record<ConvertSection, boolean>>;

export interface ConvertBody {
  include?: ConvertInclude;
}

export interface ConvertPreviewSection {
  key: ConvertSection;
  label: string;
  count: number;
  detail: string;
  available: boolean;
}

export interface ConvertPreview {
  proposalId: string;
  alreadyConverted: boolean;
  projectId: string | null;
  sections: ConvertPreviewSection[];
  setup: { projectType: string; buildingType: string; timeline: string; source: string };
  contractSum: number;
  currency: string;
  warnings: string[];
}

export interface ConvertProgrammeSeed {
  phases: Array<{
    id: string;
    project_id: string;
    building_id: string;
    name: string;
    status: string;
    date_range: string;
    start_date: string;
    end_date: string;
    sort_order: number;
    programme_task_id: string;
  }>;
  activities: Array<{
    id: string;
    project_id: string;
    building_id: string;
    phase_id: string | null;
    name: string;
    activity_type: string;
    location: null;
    status: string;
    planned_start_at: string;
    planned_end_at: string;
    worker_count_planned: number;
    notes: string | null;
    wbs_code: string | null;
    outline_level: number;
    parent_activity_id: string | null;
    predecessors: string;
    percent_complete: number;
    duration_days: number;
    baseline_start_at: string;
    baseline_end_at: string;
    is_milestone: boolean;
    source: string;
    created_by_id: string;
    programme_task_id: string;
  }>;
  keyDates: Array<{
    id: string;
    project_id: string;
    building_id: string;
    label: string;
    target_date: string;
    actual_date: null;
    status: string;
    notes: null;
    sort_order: number;
    programme_task_id: string | null;
  }>;
  phaseIdByTaskId: Map<string, string>;
  activityIdByTaskId: Map<string, string>;
}

export interface ConvertMaterialSeed {
  orders: Array<Record<string, unknown>>;
  longLeadCount: number;
}

export interface ConvertPlanSeed {
  documents: Array<Record<string, unknown>>;
  versions: Array<Record<string, unknown>>;
}

// ---------- proposal templates ----------

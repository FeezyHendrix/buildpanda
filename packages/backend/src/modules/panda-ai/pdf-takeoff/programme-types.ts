// ── Programme of work ────────────────────────────────────────────────────────
import type { Confidence, ReviewProgress, RowStatus } from "./row-types.ts";

export const PROGRAMME_DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"] as const;
export type ProgrammeDependencyType = (typeof PROGRAMME_DEPENDENCY_TYPES)[number];

export interface ProgrammeDependency {
  taskId: string;
  type: ProgrammeDependencyType;
  lagDays: number;
}

// Who last shaped a task: the drafter, a person in the editor, or a person
// through a Panda AI prompt. Drives the "AI draft vs edited" presentation.
export const PROGRAMME_TASK_ORIGINS = ["ai", "manual", "prompt"] as const;
export type ProgrammeTaskOrigin = (typeof PROGRAMME_TASK_ORIGINS)[number];

export interface PreconProgrammeTaskRow {
  id: string;
  session_id: string;
  sort: number;
  name: string;
  element_group: string | null;
  wbs_code: string | null;
  outline_level: number;
  parent_task_id: string | null;
  duration_days: string | number;
  predecessors: ProgrammeDependency[] | string;
  is_milestone: boolean;
  basis: string | null;
  confidence: Confidence | null;
  status: RowStatus;
  version: number;
  verified_by: string | null;
  verified_at: Date | string | null;
  total_float_days: number | null;
  is_critical: boolean;
  origin: ProgrammeTaskOrigin;
  created_at: Date | string;
  updated_at: Date | string;
}

/** As stored: durations and links, with no calendar attached. */
export interface PreconProgrammeTaskBase {
  id: string;
  sessionId: string;
  sort: number;
  name: string;
  elementGroup: string | null;
  wbsCode: string | null;
  outlineLevel: number;
  parentTaskId: string | null;
  durationDays: number;
  predecessors: ProgrammeDependency[];
  isMilestone: boolean;
  basis: string | null;
  confidence: Confidence | null;
  status: RowStatus;
  version: number;
  verifiedBy: string | null;
  verifiedAt: string | null;
  totalFloatDays: number | null;
  isCritical: boolean;
  origin: ProgrammeTaskOrigin;
}

/** Base plus the dates resolved by the forward pass in programme-schedule.ts. */
export interface PreconProgrammeTask extends PreconProgrammeTaskBase {
  startAt: string;
  finishAt: string;
}

export interface PreconProgramme {
  sessionId: string;
  startDate: string;
  finishDate: string | null;
  tasks: PreconProgrammeTask[];
  progress: ReviewProgress;
}

export interface UpdateProgrammeTaskBody {
  version: number;
  name?: string;
  durationDays?: number;
  isMilestone?: boolean;
  basis?: string;
  outlineLevel?: number;
  sort?: number;
  predecessors?: ProgrammeDependency[];
}

export interface CreateProgrammeTaskBody {
  name: string;
  durationDays: number;
  isMilestone?: boolean;
  basis?: string;
  outlineLevel?: number;
  /** Insert directly after this task; omitted appends at the end. */
  afterTaskId?: string;
  predecessors?: ProgrammeDependency[];
}

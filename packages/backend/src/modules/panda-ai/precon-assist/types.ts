export const ASSIST_SURFACES = ["bill", "programme", "estimate", "pack", "risks"] as const;
export type AssistSurface = (typeof ASSIST_SURFACES)[number];

// Surfaces the assistant can act on today; the others are accepted by the API
// and answered with a clear "not supported yet" so the contract holds.
export const SUPPORTED_SURFACES: readonly AssistSurface[] = ["bill", "programme"];

export const CHANGE_SET_STATUSES = ["proposed", "applied", "undone", "discarded"] as const;
export type ChangeSetStatus = (typeof CHANGE_SET_STATUSES)[number];

export const CHANGE_OPS = ["update", "create", "delete"] as const;
export type ChangeOp = (typeof CHANGE_OPS)[number];

export const CHANGE_ENTITIES = ["boq_row", "programme_task", "estimate_item", "pack_section", "risk", "sheet", "viewer", "measurement"] as const;
export type ChangeEntity = (typeof CHANGE_ENTITIES)[number];

// A line measured by hand through a prompt: drawn (vertices on a sheet) or
// stated (a figure in the prompt). heightM/depthM are the tool's factor,
// flattened so the model has one level of fields to fill.
export const MEASUREMENT_CREATE_FIELDS = [
  "sheetId",
  "tool",
  "vertices",
  "qty",
  "description",
  "elementGroup",
  "code",
  "unit",
  "heightM",
  "depthM",
  "typical",
  "rate",
  "billId",
] as const;

// The viewer's tools, so a prompt can drive them: "switch to the area tool
// on sheet 2" is a viewer change the client executes after apply.
export const VIEWER_TOOLS = ["select", "area", "linear", "count", "deduct", "scale"] as const;
export type ViewerTool = (typeof VIEWER_TOOLS)[number];
export const VIEWER_FIELDS = ["tool", "sheetId", "zoom"] as const;
export const VIEWER_ZOOMS = ["in", "out", "fit"] as const;
// Sheet corrections a prompt may make; scaleRatio is the human "1:100" number.
export const SHEET_UPDATE_FIELDS = ["kind", "title", "scaleRatio", "dimUnit"] as const;

// Fields the model may set per entity. Anything else in `after` is dropped
// before the change is stored, so a hallucinated column never reaches a service.
export const BOQ_ROW_UPDATE_FIELDS = ["description", "qty", "rate", "unit", "status"] as const;
export const BOQ_ROW_CREATE_FIELDS = ["billId", "rowType", "description", "elementGroup", "code", "unit", "qty", "rate"] as const;
export const PROGRAMME_TASK_UPDATE_FIELDS = [
  "name",
  "durationDays",
  "isMilestone",
  "basis",
  "status",
  "outlineLevel",
  "sort",
  "predecessors",
] as const;
// Task fields the current programme service can persist; the rest are recorded
// as skipped at apply time until the full task editor lands.
export const PROGRAMME_TASK_APPLIABLE_FIELDS = ["name", "durationDays", "isMilestone", "basis", "status"] as const;

export interface AssistChange {
  op: ChangeOp;
  entity: ChangeEntity;
  id?: string;
  before?: Record<string, unknown> | null;
  after: Record<string, unknown>;
  // filled in server-side: a one-line label for the diff ("225mm blockwork · qty")
  label?: string;
}

export interface UndoStep {
  kind: "update" | "verify" | "reject" | "remove" | "recreate";
  id?: string;
  before?: Record<string, unknown>;
}

export interface AppliedChange {
  index: number;
  outcome: "applied" | "skipped";
  reason?: string;
  undo?: UndoStep;
}

export interface AppliedResult {
  applied: number;
  skipped: number;
  changes: AppliedChange[];
}

// ---------- rows (snake_case, DB) ----------

export interface ChangeSetRow {
  id: string;
  session_id: string | null;
  proposal_id: string | null;
  surface: AssistSurface;
  prompt: string;
  plan_json: string[];
  changes: AssistChange[];
  status: ChangeSetStatus;
  applied_result: AppliedResult | null;
  created_by: string | null;
  created_at: Date;
  applied_at: Date | null;
}

// ---------- DTOs (camelCase) ----------

export interface ChangeSet {
  id: string;
  sessionId: string | null;
  proposalId: string | null;
  surface: AssistSurface;
  prompt: string;
  plan: string[];
  changes: AssistChange[];
  status: ChangeSetStatus;
  appliedResult: AppliedResult | null;
  createdBy: string | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface AssistViewerContext {
  activeSheetId?: string;
  tool?: ViewerTool;
}

export interface AssistRequestBody {
  sessionId?: string;
  proposalId?: string;
  surface: AssistSurface;
  prompt: string;
  // what the user is looking at, so "this sheet" and "the current tool" resolve
  context?: AssistViewerContext;
}

export interface ChangeSetParams {
  changeSetId: string;
}

// Permission check injected by the route: the assistant applies each change
// through the same service the buttons use, and must hold the same grant.
export type CanFn = (resource: string, action: string) => boolean;

import type { BadgeTone } from "@/components/atoms/badge";
import type {
  FoundationType,
  PreconPhase,
  PreconSessionStatus,
  PreconSheetKind,
  RowOrigin,
  StructuralSystem,
  StructureClass,
  StructureContext,
  TakeoffKind,
  TakeoffScope,
  TakeoffScopeKind,
} from "@/api/precon";
import type { TakeoffStatus } from "@/api/proposals";

// One vocabulary for every place a take-off shows up: the Plans tab list, the
// session header, the generate checklist. Raw enum strings never reach the UI.

export const PRECON_STATUS_LABEL: Record<PreconSessionStatus, string> = {
  uploading: "Queued",
  generating: "Measuring",
  reviewing: "Ready to review",
  output: "Reviewed",
  failed: "Failed",
};

export const PRECON_STATUS_TONE: Record<PreconSessionStatus, BadgeTone> = {
  uploading: "neutral",
  generating: "info",
  reviewing: "warning",
  output: "success",
  failed: "danger",
};

export const DWG_STATUS_LABEL: Record<TakeoffStatus, string> = {
  pending: "Queued",
  processing: "Measuring",
  completed: "Ready to review",
  failed: "Failed",
};

export const DWG_STATUS_TONE: Record<TakeoffStatus, BadgeTone> = {
  pending: "neutral",
  processing: "info",
  completed: "success",
  failed: "danger",
};

export interface PhaseMeta {
  id: PreconPhase;
  label: string;
  hint: string;
}

export const PRECON_PHASE_META: readonly PhaseMeta[] = [
  { id: "reading", label: "Reading drawings", hint: "Finding the scale and tracing walls, doors and spaces on each sheet" },
  { id: "structure", label: "Detecting structure", hint: "Working out the building type, storeys and structural system" },
  { id: "schedules", label: "Reading schedules", hint: "Door, window and reinforcement schedules become authoritative counts" },
  { id: "building", label: "Building the bill", hint: "QS agents expand measured anchors into billable lines" },
  { id: "pricing", label: "Pricing", hint: "Rates from your most recent rate card" },
  { id: "draft", label: "Draft ready", hint: "Every line goes to human review next" },
] as const;

// An areas-only run never builds or prices a bill, so its checklist is shorter
// and stays honest about what the engine is doing.
const AREAS_PHASES: ReadonlySet<PreconPhase> = new Set(["reading", "structure", "draft"]);

const DWG_PHASES: readonly PhaseMeta[] = [
  { id: "reading", label: "Reading the DWG", hint: "The automated take-off reads walls, columns and openings from the model" },
  { id: "draft", label: "Lines ready", hint: "Every line goes to human review next" },
];

export function phasesForScope(scope: TakeoffScope, takeoffKind?: TakeoffKind): readonly PhaseMeta[] {
  if (takeoffKind === "dwg") return DWG_PHASES;
  if (scope.kind === "areas") {
    return PRECON_PHASE_META.filter((p) => AREAS_PHASES.has(p.id)).map((p) =>
      p.id === "draft" ? { ...p, label: "Areas ready", hint: "One line per identified space, in m²" } : p,
    );
  }
  return PRECON_PHASE_META;
}

export const TAKEOFF_SCOPE_META: Record<TakeoffScopeKind, { label: string; description: string; noun: string }> = {
  full: {
    label: "Full bill of quantities",
    description: "Measure everything on the drawings, build up a BESMM bill and price it against your rate card.",
    noun: "Draft BoQ",
  },
  sections: {
    label: "Selected sections only",
    description: "Only bill the elements you pick — a finishes-only bill, say. Everything else on the drawings is ignored.",
    noun: "Sections bill",
  },
  areas: {
    label: "Measured areas only",
    description: "Skip the bill. Just list the floor area of every identifiable room or space in m², ready to export.",
    noun: "Measured areas",
  },
  materials: {
    label: "Materials schedule",
    description: "A buying list with quantities and needed-by dates for a labour-only job where the client buys materials.",
    noun: "Materials schedule",
  },
  early: {
    label: "Early estimate",
    description: "No drawings yet: floor areas per level against benchmark rates, re-measured once drawings arrive.",
    noun: "Early estimate",
  },
};

// Which scopes the measure dialog offers for a job profile. Materials only
// makes sense when the client buys them; early estimates start from a lead.
export const SCOPES_FOR_PROFILE: Record<string, readonly TakeoffScopeKind[]> = {
  full_contract: ["full", "sections", "areas"],
  labour_only: ["full", "sections", "areas", "materials"],
  supply_only: ["materials", "areas"],
};
export const DEFAULT_MEASURE_SCOPES: readonly TakeoffScopeKind[] = SCOPES_FOR_PROFILE["full_contract"]!;

// Mirrors BESMM_ELEMENT_ORDER on the backend; the API validates against it.
export const TAKEOFF_SECTIONS = [
  { group: "Finishes", elements: ["Wall finishings", "Floor finishings", "Ceiling finishings"] },
  { group: "Structure", elements: ["Substructure", "Frame", "Upper floors", "Staircases", "Roof"] },
  { group: "Envelope", elements: ["Internal and external walls", "Windows", "Doors"] },
  { group: "Services", elements: ["Mechanical services", "Electrical services"] },
  { group: "Site", elements: ["Preliminaries", "External works"] },
] as const;

export const FINISHES_ELEMENTS: string[] = [...TAKEOFF_SECTIONS[0].elements];

export function describeScope(scope: TakeoffScope): string {
  if (scope.kind === "sections") {
    return scope.elements.length === FINISHES_ELEMENTS.length &&
      scope.elements.every((e) => FINISHES_ELEMENTS.includes(e))
      ? "Finishes only"
      : scope.elements.join(", ");
  }
  return TAKEOFF_SCOPE_META[scope.kind].noun;
}

/** Panda AI reads these. */
export const MEASURABLE_PLAN = /\.(pdf|dwg)$/i;
export const PDF_PLAN = /\.pdf$/i;
/** A photo or scan: no engine, but a person can calibrate it and measure by hand. */
export const PICTURE_PLAN = /\.(png|jpe?g|webp)$/i;
/** Anything a person can open on the sheet viewer and measure. */
export const HAND_MEASURABLE_PLAN = /\.(pdf|dwg|png|jpe?g|webp)$/i;

const STRUCTURAL_SYSTEM_LABEL: Record<string, string> = {
  "reinforced-concrete-frame": "RC frame",
  "load-bearing-masonry": "Load-bearing masonry",
  "steel-frame": "Steel frame",
  composite: "Composite",
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function formatStructureContext(ctx: StructureContext | null): string | null {
  if (!ctx || ctx.structureClass === "unknown") return null;
  const parts = [capitalise(ctx.structureClass)];
  if (ctx.buildingType) parts.push(capitalise(ctx.buildingType));
  if (ctx.storeys) parts.push(`${ctx.storeys} storeys`);
  const system = STRUCTURAL_SYSTEM_LABEL[ctx.structuralSystem];
  if (system) parts.push(system);
  if (ctx.foundationType !== "unknown") parts.push(`${capitalise(ctx.foundationType)} foundation`);
  return parts.join(" · ");
}

// ---- job profiles and drawing metadata (WS-3) ----

import type { JobProfile, PlanDiscipline } from "@/api/proposals";

export const JOB_PROFILE_META: Record<JobProfile, { label: string; description: string; short: string }> = {
  full_contract: {
    label: "Full contract",
    short: "Labour and materials",
    description: "You supply labour and materials. Every line is priced; material orders are yours at handoff.",
  },
  labour_only: {
    label: "Labour-only",
    short: "Client buys materials",
    description:
      "The client buys materials. Labour rates only; the client receives a buying list with quantities and needed-by dates.",
  },
  supply_only: {
    label: "Supply-only",
    short: "Materials, no site labour",
    description: "Material lines priced, no preliminaries. Delivery stages instead of build stages.",
  },
};

export const PLAN_DISCIPLINE_LABEL: Record<PlanDiscipline, string> = {
  architectural: "Architectural",
  structural: "Structural",
  mep: "MEP",
  civil: "Civil / site",
  survey: "Survey",
  other: "Other",
};

export const TAKEOFF_KIND_LABEL: Record<TakeoffKind, string> = {
  pdf: "PDF drawing",
  dwg: "DWG automated take-off",
  manual: "Hand-priced sheet",
  early: "Early estimate",
};

// The engine's doubt, in the reviewer's words. Keys are what the backend writes.
export const CONFIDENCE_REASON_LABEL: Record<string, string> = {
  scale: "Scale uncertain",
  "schedule differs": "Schedule disagrees with plan",
  "two sheets summed": "Summed across sheets",
  vision: "Read from a raster image",
  envelope: "Building not isolated",
  "room fill": "Room area by flood fill",
  "agent estimate": "Estimated by QS agent",
  provisional: "Provisional sum",
  "medium confidence": "Medium confidence",
  "low confidence": "Low confidence",
};

const CONFIDENCE_LEVEL_WORD = /^(high|medium|low)$/i;

/**
 * A stored reason is "why · check; check; check" (older rows start with the
 * bare level word, which the badge already shows). Returns the parts in
 * order, labelled where a short key has a friendlier label.
 */
export function confidenceReasonParts(reason: string | null): string[] {
  if (!reason) return [];
  return reason
    .split(/\s·\s|;\s+(?=[a-z0-9])/i)
    .map((part) => part.trim())
    .filter((part) => part && !CONFIDENCE_LEVEL_WORD.test(part))
    .map((part) => CONFIDENCE_REASON_LABEL[part] ?? part);
}

/** The headline reason, short enough for a bill row. */
export function confidenceReasonLabel(reason: string | null): string | null {
  return confidenceReasonParts(reason)[0] ?? null;
}

export const ROW_ORIGIN_LABEL: Record<RowOrigin, string> = {
  ai: "Measured by Panda AI",
  manual: "Entered by hand",
  prompt: "Changed by a Panda AI prompt",
  migrated: "Migrated from the old BoQ grid",
};

export const SHEET_KIND_OPTIONS: { value: PreconSheetKind; label: string }[] = [
  { value: "floor-plan", label: "Floor plan" },
  { value: "roof-plan", label: "Roof plan" },
  { value: "elevation", label: "Elevation" },
  { value: "section", label: "Section" },
  { value: "detail", label: "Detail" },
  { value: "schedule", label: "Schedule" },
  { value: "unknown", label: "Unknown" },
];

export const STRUCTURE_CLASS_OPTIONS: { value: StructureClass; label: string }[] = [
  { value: "building", label: "Building" },
  { value: "road", label: "Road" },
  { value: "bridge", label: "Bridge" },
  { value: "airport", label: "Airport" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "unknown", label: "Unknown" },
];

export const STRUCTURAL_SYSTEM_OPTIONS: { value: StructuralSystem; label: string }[] = [
  { value: "load-bearing-masonry", label: "Load-bearing masonry" },
  { value: "reinforced-concrete-frame", label: "Reinforced concrete frame" },
  { value: "steel-frame", label: "Steel frame" },
  { value: "composite", label: "Composite" },
  { value: "unknown", label: "Unknown" },
];

export const FOUNDATION_TYPE_OPTIONS: { value: FoundationType; label: string }[] = [
  { value: "strip", label: "Strip" },
  { value: "raft", label: "Raft" },
  { value: "pad", label: "Pad" },
  { value: "pile", label: "Pile" },
  { value: "unknown", label: "Unknown" },
];

// Points per mm at 1:1; a sheet at 1:N has N × this many mm per point.
export const MM_PER_PT_AT_1_TO_1 = 0.3528;
export const scaleRatioOf = (mmPerPt: number): number => Math.round(mmPerPt / MM_PER_PT_AT_1_TO_1);
export const mmPerPtForRatio = (ratio: number): number => ratio * MM_PER_PT_AT_1_TO_1;

// ---- sheet viewer tools (WS-M1B) ----
// One palette for every take-off: what each tool draws, its key and its unit.
// Icons live beside the viewer (precon-sheet-viewer/tool-icons.ts) so this file
// stays free of React and the shortcut map can be unit-tested in node.

import type { MeasureTool } from "@/api/precon";

export const PRECON_TOOLS = [
  "select",
  "magnifier",
  "length",
  "linear",
  "area",
  "room_fill",
  "count",
  "volume",
  "wall_area",
  "deduct",
  "typical",
  "scale",
  "viewports",
  "find_symbol",
  "overlay",
  "legend",
  "pen",
  "comment",
] as const;
export type PreconTool = (typeof PRECON_TOOLS)[number];

export const PRECON_TOOL_GROUPS = ["navigate", "measure", "modify", "check", "markup"] as const;
export type PreconToolGroup = (typeof PRECON_TOOL_GROUPS)[number];

export interface PreconToolMeta {
  key: PreconTool;
  label: string;
  /** Single letter; pressed on its own while the viewer is focused. */
  shortcut: string;
  /** Shown in the tooltip and the status bar while drawing; null for navigation tools. */
  unit: string | null;
  group: PreconToolGroup;
  hint: string;
  /** The backend measurement this tool creates when no bill line is selected. */
  measure?: MeasureTool;
  /** Needs a selected bill line (Deduct, Typical). */
  needsLine?: boolean;
  /** Not built yet: stays visible in the palette, disabled, with the milestone. */
  deferred?: string;
}

export const PRECON_TOOL_META: readonly PreconToolMeta[] = [
  { key: "select", label: "Select", shortcut: "V", unit: null, group: "navigate", hint: "Pan, zoom and pick measurements" },
  { key: "magnifier", label: "Magnifier", shortcut: "Z", unit: null, group: "navigate", hint: "Hold to magnify under the cursor; click to keep it on" },
  { key: "length", label: "Length", shortcut: "L", unit: "m", group: "measure", hint: "Two clicks; snaps to line ends", measure: "length" },
  { key: "linear", label: "Polyline", shortcut: "P", unit: "m", group: "measure", hint: "Click a path, Enter to finish", measure: "polyline" },
  { key: "area", label: "Area", shortcut: "A", unit: "m²", group: "measure", hint: "Polygon by clicks, Enter to close", measure: "area" },
  { key: "room_fill", label: "Room fill", shortcut: "R", unit: "m²", group: "measure", hint: "Click inside an enclosed space" },
  { key: "count", label: "Count", shortcut: "C", unit: "nr", group: "measure", hint: "A pin per item, Enter to finish", measure: "count" },
  { key: "volume", label: "Volume", shortcut: "B", unit: "m³", group: "measure", hint: "Area plus a depth", measure: "volume" },
  { key: "wall_area", label: "Wall area", shortcut: "W", unit: "m²", group: "measure", hint: "Polyline plus a height", measure: "wall_area" },
  { key: "deduct", label: "Deduct", shortcut: "D", unit: "same as parent", group: "modify", hint: "Draw an opening on the selected line", needsLine: true },
  { key: "typical", label: "Typical ×N", shortcut: "T", unit: "×", group: "modify", hint: "Repeat the selected line on identical floors", needsLine: true },
  { key: "scale", label: "Set scale", shortcut: "S", unit: "1:n", group: "modify", hint: "Two points a known distance apart" },
  { key: "viewports", label: "Viewport", shortcut: "U", unit: "1:n", group: "modify", hint: "Drag a box on a details sheet that has its own scale" },
  { key: "find_symbol", label: "Find symbol", shortcut: "F", unit: "nr", group: "check", hint: "Drag a box round one symbol to find every match on the sheet" },
  { key: "overlay", label: "Overlay", shortcut: "O", unit: null, group: "check", hint: "Previous drawing revision under this one, in red" },
  { key: "legend", label: "Legend", shortcut: "G", unit: null, group: "check", hint: "Element groups and totals on this sheet" },
  // Markup says something about the drawing; it is never a quantity. P and C
  // already mean Polyline and Count, so freehand takes I for ink.
  { key: "pen", label: "Pen", shortcut: "I", unit: null, group: "markup", hint: "Draw freehand on the sheet; a note, not a measurement" },
  { key: "comment", label: "Comment", shortcut: "N", unit: null, group: "markup", hint: "Pin a comment on the sheet, on the selected line if there is one" },
];

export const PRECON_TOOL_BY_KEY: Record<PreconTool, PreconToolMeta> = Object.fromEntries(
  PRECON_TOOL_META.map((meta) => [meta.key, meta]),
) as Record<PreconTool, PreconToolMeta>;

/** Tools that draw a new bill line when nothing is selected, in palette order. */
export const MEASURING_TOOLS: readonly PreconToolMeta[] = PRECON_TOOL_META.filter((meta) => meta.measure && !meta.deferred);

/** A bare letter (no modifier) → the tool it selects, or null. */
export function toolForShortcut(key: string, modifiers: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {}): PreconTool | null {
  if (modifiers.ctrl || modifiers.meta || modifiers.alt || key.length !== 1) return null;
  const upper = key.toUpperCase();
  return PRECON_TOOL_META.find((meta) => meta.shortcut === upper)?.key ?? null;
}

/** Keys must never fire while the user is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object" || !("tagName" in target)) return false;
  const el = target as { tagName: string; isContentEditable?: boolean };
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable === true;
}

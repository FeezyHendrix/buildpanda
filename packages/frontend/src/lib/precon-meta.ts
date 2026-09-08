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

export function phasesForScope(scope: TakeoffScope): readonly PhaseMeta[] {
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

export const MEASURABLE_PLAN = /\.(pdf|dwg)$/i;
export const PDF_PLAN = /\.pdf$/i;

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

export function confidenceReasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  return CONFIDENCE_REASON_LABEL[reason] ?? reason;
}

export const ROW_ORIGIN_LABEL: Record<RowOrigin, string> = {
  ai: "Measured by Panda AI",
  manual: "Entered by hand",
  prompt: "Changed by a Panda AI prompt",
  migrated: "Migrated from the old BoQ grid",
};

export const SHEET_KIND_OPTIONS: { value: PreconSheetKind; label: string }[] = [
  { value: "floor-plan", label: "Floor plan" },
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

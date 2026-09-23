// The measurement as it was *made*, not as it was flattened.
//
// `precon_geometries.vertices` records where a line ended up; it cannot say
// which tool drew it, what height turned a 7 m run into 18.9 m2, or which sheet
// scale that figure was taken against. So redrawing the line loses the factor,
// and a re-scaled sheet silently restates quantities nobody re-measured.
//
// A definition is the lossless record that fixes both: tool + shape + factor +
// scale binding + the assembly as it stood when the line was drawn. It is
// versioned (`schemaVersion`) because a stored measurement outlives the code
// that wrote it and has to stay readable in a dispute years later.

import { BadRequestError } from "../../../lib/errors.ts";
import {
  DEDUCTION_MODES,
  MEASURE_TOOLS,
  type DeductionDefinitionV1,
  type DefinitionV1,
  type AssemblySnapshot,
  type DeductionMode,
  type MeasurementDefinitionV1,
  type MeasurementFactor,
  type MeasurementShape,
  type MeasurementTool,
  type PathSegment,
  type ScaleBinding,
} from "./geometry-types.ts";

// The definition TYPES live with the geometry they describe; this file owns the
// PARSE of them. Re-exported so every importer keeps its existing path.
export type {
  ArcSegment,
  AssemblySnapshot,
  DeductionDefinitionV1,
  DefinitionV1,
  LineSegment,
  MeasurementDefinitionV1,
  MeasurementFactor,
  MeasurementShape,
  MeasurementTool,
  PathSegment,
  ScaleBinding,
} from "./geometry-types.ts";
export { DEDUCTION_MODES, type DeductionMode } from "./geometry-types.ts";


// ---------- validation ----------

function reject(message: string): never {
  throw new BadRequestError(message);
}

function asObject(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) reject(`${where} must be an object`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) reject(`${where} must be a non-empty string`);
  return value;
}

/** A NaN or Infinity anywhere in the geometry produces a quantity nobody can defend. */
function asFinite(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) reject(`${where} must be a finite number`);
  return value;
}

function asPositive(value: unknown, where: string): number {
  const n = asFinite(value, where);
  if (n <= 0) reject(`${where} must be greater than zero`);
  return n;
}

function asPoint(value: unknown, where: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) reject(`${where} must be a [x, y] pair`);
  return [asFinite(value[0], `${where}[0]`), asFinite(value[1], `${where}[1]`)];
}

function asSegment(value: unknown, where: string): PathSegment {
  const raw = asObject(value, where);
  if (raw["kind"] === "line") return { kind: "line", end: asPoint(raw["end"], `${where}.end`) };
  if (raw["kind"] === "arc") {
    return { kind: "arc", mid: asPoint(raw["mid"], `${where}.mid`), end: asPoint(raw["end"], `${where}.end`) };
  }
  return reject(`${where}.kind must be "line" or "arc"`);
}

function asShape(value: unknown, where: string): MeasurementShape {
  const raw = asObject(value, where);
  if (raw["role"] === "path") {
    const segments = raw["segments"];
    if (!Array.isArray(segments)) reject(`${where}.segments must be an array`);
    return {
      role: "path",
      start: asPoint(raw["start"], `${where}.start`),
      segments: segments.map((s, i) => asSegment(s, `${where}.segments[${i}]`)),
      closed: raw["closed"] === true,
    };
  }
  if (raw["role"] === "points") {
    const points = raw["points"];
    if (!Array.isArray(points)) reject(`${where}.points must be an array`);
    return { role: "points", points: points.map((p, i) => asPoint(p, `${where}.points[${i}]`)) };
  }
  return reject(`${where}.role must be "path" or "points"`);
}

function asFactor(value: unknown): MeasurementFactor {
  const raw = asObject(value, "factor");
  const factor: MeasurementFactor = {};
  if (raw["heightM"] !== undefined) factor.heightM = asPositive(raw["heightM"], "factor.heightM");
  if (raw["depthM"] !== undefined) factor.depthM = asPositive(raw["depthM"], "factor.depthM");
  return factor;
}

function asScale(value: unknown): ScaleBinding {
  const raw = asObject(value, "scale");
  const sheetVersion = asFinite(raw["sheetVersion"], "scale.sheetVersion");
  const appliedMmPerPt = asPositive(raw["appliedMmPerPt"], "scale.appliedMmPerPt");
  if (raw["source"] === "sheet") return { source: "sheet", sheetVersion, appliedMmPerPt };
  if (raw["source"] === "viewport") {
    return {
      source: "viewport",
      viewportId: asString(raw["viewportId"], "scale.viewportId"),
      sheetVersion,
      appliedMmPerPt,
    };
  }
  return reject('scale.source must be "sheet" or "viewport"');
}

function asAssembly(value: unknown): AssemblySnapshot {
  const raw = asObject(value, "assembly");
  return {
    assemblyId: asString(raw["assemblyId"], "assembly.assemblyId"),
    assemblyName: asString(raw["assemblyName"], "assembly.assemblyName"),
    factor: asFinite(raw["factor"], "assembly.factor"),
    unit: asString(raw["unit"], "assembly.unit"),
    description: typeof raw["description"] === "string" ? raw["description"] : "",
  };
}

function asDimensions(value: unknown): DeductionDefinitionV1["dimensions"] {
  const raw = asObject(value, "dimensions");
  const dims: NonNullable<DeductionDefinitionV1["dimensions"]> = {};
  if (raw["widthM"] !== undefined) dims.widthM = asPositive(raw["widthM"], "dimensions.widthM");
  if (raw["heightM"] !== undefined) dims.heightM = asPositive(raw["heightM"], "dimensions.heightM");
  if (raw["depthM"] !== undefined) dims.depthM = asPositive(raw["depthM"], "dimensions.depthM");
  return dims;
}

function asMeasurement(raw: Record<string, unknown>): MeasurementDefinitionV1 {
  const tool = raw["tool"];
  if (typeof tool !== "string" || !(MEASURE_TOOLS as readonly string[]).includes(tool)) {
    reject(`definition.tool must be one of ${MEASURE_TOOLS.join(", ")}`);
  }
  const definition: MeasurementDefinitionV1 = {
    schemaVersion: 1,
    role: "measurement",
    tool: tool as MeasurementTool,
    shape: asShape(raw["shape"], "shape"),
  };
  if (raw["factor"] !== undefined) definition.factor = asFactor(raw["factor"]);
  if (raw["scale"] !== undefined) definition.scale = asScale(raw["scale"]);
  if (raw["assembly"] !== undefined) definition.assembly = asAssembly(raw["assembly"]);
  return definition;
}

function asDeduction(raw: Record<string, unknown>): DeductionDefinitionV1 {
  const mode = raw["mode"];
  if (typeof mode !== "string" || !(DEDUCTION_MODES as readonly string[]).includes(mode)) {
    reject(`definition.mode must be one of ${DEDUCTION_MODES.join(", ")}`);
  }
  const definition: DeductionDefinitionV1 = {
    schemaVersion: 1,
    role: "deduction",
    parentGeometryId: asString(raw["parentGeometryId"], "definition.parentGeometryId"),
    mode: mode as DeductionMode,
  };
  if (raw["shape"] !== undefined) definition.shape = asShape(raw["shape"], "shape");
  if (raw["dimensions"] !== undefined) definition.dimensions = asDimensions(raw["dimensions"]);
  return definition;
}

/**
 * Parse an untrusted definition into the stored shape, or refuse it. Nothing
 * half-valid is persisted: a definition that cannot be re-measured later is
 * worse than none, because the bill line would look defensible and not be.
 */
export function validateDefinitionV1(value: unknown): DefinitionV1 {
  const raw = asObject(value, "definition");
  if (raw["schemaVersion"] !== 1) reject("definition.schemaVersion must be 1");
  if (raw["role"] === "measurement") return asMeasurement(raw);
  if (raw["role"] === "deduction") return asDeduction(raw);
  return reject('definition.role must be "measurement" or "deduction"');
}

/**
 * A stored definition as a reader may trust it, or null.
 *
 * The same parse as `validateDefinitionV1`, which rebuilds every field and is
 * therefore already an allowlist — but refusing is wrong on the way OUT. A
 * column older code also wrote has records this cannot read, and throwing would
 * take a whole take-off's snapshot down over one of them. Unreadable becomes
 * null, which is the honest answer: this drawing does not say how it was
 * measured. It must never be reported as a measurement with defaults filled in,
 * because the editor would then offer to re-measure from a basis nobody stated.
 */
export function readDefinitionV1(value: unknown): DefinitionV1 | null {
  if (value === null || value === undefined) return null;
  try {
    return validateDefinitionV1(value);
  } catch {
    return null;
  }
}

/**
 * `precon_boq_rows.measurement_settings`. Absence means a legacy line, never
 * permission to reset one (contract 17).
 */
export interface MeasurementSettingsV1 {
  schemaVersion: 1;
  quantityMode: "measured" | "stated";
  repeatLabels?: string[];
  statedQuantity?: {
    tool: MeasurementTool;
    qty: number;
    unit: string;
    factor?: MeasurementFactor;
    actor: string;
    at: string;
  };
}

export type StatedQuantityV1 = NonNullable<MeasurementSettingsV1["statedQuantity"]>;

function statedQuantityOrNull(value: unknown): StatedQuantityV1 | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const { tool, qty, unit, actor, at, factor } = raw;
  if (!(MEASURE_TOOLS as readonly unknown[]).includes(tool)) return null;
  if (typeof qty !== "number" || !Number.isFinite(qty)) return null;
  if (typeof unit !== "string" || typeof actor !== "string" || typeof at !== "string") return null;
  const stated: StatedQuantityV1 = { tool: tool as MeasurementTool, qty, unit, actor, at };
  if (typeof factor === "object" && factor !== null && !Array.isArray(factor)) {
    const { heightM, depthM } = factor as Record<string, unknown>;
    const only: MeasurementFactor = {};
    if (typeof heightM === "number" && Number.isFinite(heightM)) only.heightM = heightM;
    if (typeof depthM === "number" && Number.isFinite(depthM)) only.depthM = depthM;
    if (only.heightM !== undefined || only.depthM !== undefined) stated.factor = only;
  }
  return stated;
}

/**
 * `measurement_settings` as a reader may trust it, or null.
 *
 * Deliberately lenient where `validateDefinitionV1` refuses: this runs on the
 * READ path over a jsonb column that older code also wrote, and a legacy line
 * has to stay readable. Refusing here would take a whole take-off's snapshot
 * down over one malformed record.
 *
 * It is an allowlist by construction — every field is rebuilt, never spread —
 * so nothing a client is handed can be something the record does not declare.
 * A half-valid part is dropped rather than repaired: a stated quantity whose
 * figure is not a number is not a stated quantity, and serving it as one would
 * put an undefendable number in front of a QS.
 */
export function readMeasurementSettings(value: unknown): MeasurementSettingsV1 | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const labels = Array.isArray(raw["repeatLabels"])
    ? raw["repeatLabels"].filter((label): label is string => typeof label === "string" && label.length > 0)
    : [];
  const stated = statedQuantityOrNull(raw["statedQuantity"]);
  const settings: MeasurementSettingsV1 = {
    schemaVersion: 1,
    quantityMode: raw["quantityMode"] === "stated" ? "stated" : "measured",
  };
  if (labels.length > 0) settings.repeatLabels = labels;
  if (stated) settings.statedQuantity = stated;
  return settings;
}

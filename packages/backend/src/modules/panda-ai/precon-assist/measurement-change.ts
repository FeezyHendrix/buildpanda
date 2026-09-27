import { ValidationError } from "../../../lib/errors.ts";
import { MEASURE_TOOLS } from "../pdf-takeoff/types.ts";
import type { CreateMeasurementBody, MeasureFactor, MeasureTool, StatedMeasurementBody } from "../pdf-takeoff/types.ts";
import type { PreconService } from "./applier.ts";
import type { AssistDraft, BillContext } from "./planner.ts";
import { MEASUREMENT_CREATE_FIELDS, type AppliedChange, type AssistChange } from "./types.ts";

// The "measurement" entity: a prompt such as "add a 12 m length of 225 wall on
// DWG-01 at 2.7 m high" becomes one line measured by hand. With vertices it is
// drawn on the sheet; with a stated figure it is a plain manual row whose
// basis says the number came from the prompt.

export const MEASUREMENT_PROMPT_LINES = [
  `measurement create: a bill line measured by hand. allowed after fields: ${MEASUREMENT_CREATE_FIELDS.join(", ")}. tool is one of ${MEASURE_TOOLS.join(", ")} (length and polyline give m, area gives m², count gives nr, volume gives m³ and needs depthM, wall_area gives m² and needs heightM).`,
  "Give vertices (sheet points, [[x, y], ...]) only when the user named exact points. When the user states a figure (\"12 m of 225 wall\"), give qty as the drawn figure — length in m for length, polyline and wall_area; area in m² for area and volume; a count for count — and no vertices. sheetId is the sheet the user named, else context.viewer.activeSheetId; it is required with vertices. typical is × identical floors. description and elementGroup are required.",
  "Use measurement when the user wants a line added with a quantity they state; use viewer when they want to draw it themselves.",
];

type DraftChange = AssistDraft["changes"][number];

function pick(source: Record<string, unknown>, allowed: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) if (key in source && source[key] !== null && source[key] !== undefined) out[key] = source[key];
  return out;
}

const isPoint = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));

function requirePositive(after: Record<string, unknown>, key: string): void {
  if (key in after && !(typeof after[key] === "number" && after[key] > 0)) {
    throw new ValidationError(`Panda AI proposed a ${key} that is not a positive number`);
  }
}

export function normaliseMeasurementChange(change: DraftChange, ctx: BillContext): AssistChange {
  if (change.op !== "create") throw new ValidationError("A measurement can only be created by a prompt");
  const after = pick(change.after, MEASUREMENT_CREATE_FIELDS);
  if (!(MEASURE_TOOLS as readonly unknown[]).includes(after["tool"])) {
    throw new ValidationError("Panda AI proposed a measuring tool that does not exist");
  }
  if (typeof after["description"] !== "string" || after["description"].trim() === "") {
    throw new ValidationError("Panda AI proposed a measurement with no description");
  }
  if (typeof after["elementGroup"] !== "string" || after["elementGroup"].trim() === "") {
    throw new ValidationError("Panda AI proposed a measurement with no element group");
  }
  const hasVertices = "vertices" in after;
  const hasQty = "qty" in after;
  if (hasVertices === hasQty) throw new ValidationError("A measurement needs either vertices to draw or a stated qty, not both");
  if (hasVertices && !(Array.isArray(after["vertices"]) && after["vertices"].length > 0 && after["vertices"].every(isPoint))) {
    throw new ValidationError("Panda AI proposed vertices that are not [x, y] sheet points");
  }
  const sheetById = new Map((ctx.sheets ?? []).map((s) => [s.id, s]));
  if (hasVertices && !("sheetId" in after)) throw new ValidationError("A drawn measurement needs the sheet it is drawn on");
  if ("sheetId" in after && !sheetById.has(String(after["sheetId"]))) {
    throw new ValidationError("Panda AI referenced a sheet that does not exist");
  }
  if ("billId" in after && !ctx.bills.some((b) => b.id === after["billId"])) {
    throw new ValidationError("Panda AI proposed a measurement on a bill that does not exist");
  }
  for (const key of ["qty", "heightM", "depthM", "rate"]) requirePositive(after, key);
  if ("typical" in after && !(Number.isInteger(after["typical"]) && (after["typical"] as number) >= 1)) {
    throw new ValidationError("Panda AI proposed a typical count that is not a whole number");
  }
  const sheet = "sheetId" in after ? sheetById.get(String(after["sheetId"])) : undefined;
  const figure = hasQty ? `${after["qty"]} stated` : `${(after["vertices"] as unknown[]).length} points`;
  const label = `Measure · ${after["description"]} (${String(after["tool"]).replace("_", " ")}, ${figure}${sheet ? ` on ${sheet.code ?? sheet.fileName}` : ""})`;
  return { op: "create", entity: "measurement", after, label };
}

const numberOr = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const stringOr = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

function factorOf(a: Record<string, unknown>): MeasureFactor | undefined {
  const heightM = numberOr(a["heightM"]);
  const depthM = numberOr(a["depthM"]);
  return heightM === undefined && depthM === undefined ? undefined : { heightM, depthM };
}

// Through the same service the composer dialog calls, so a prompted line is
// exactly as verified, attributed and evidenced as a drawn one.
export async function applyMeasurement(index: number, change: AssistChange, sessionId: string, precon: PreconService, actor: string): Promise<AppliedChange> {
  const a = change.after;
  const shared = {
    tool: a["tool"] as MeasureTool,
    description: String(a["description"] ?? ""),
    elementGroup: String(a["elementGroup"] ?? ""),
    code: stringOr(a["code"]),
    unit: stringOr(a["unit"]),
    factor: factorOf(a),
    typical: numberOr(a["typical"]),
    rate: numberOr(a["rate"]),
    billId: stringOr(a["billId"]),
  };
  if (Array.isArray(a["vertices"])) {
    const body: CreateMeasurementBody = { ...shared, sheetId: String(a["sheetId"]), vertices: a["vertices"] as number[][] };
    const created = await precon.createMeasurement(sessionId, body, actor);
    return { index, outcome: "applied", undo: { kind: "remove", id: created.row.id } };
  }
  const body: StatedMeasurementBody = { ...shared, qty: Number(a["qty"]), sheetId: stringOr(a["sheetId"]) };
  const created = await precon.createStatedMeasurement(sessionId, body, actor);
  return { index, outcome: "applied", undo: { kind: "remove", id: created.id } };
}

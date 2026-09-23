// Reading a recorded state back out of an audit row, as typed values.
//
// `OperationStateV1` stores the reversible parts of a record as `unknown`,
// which is honest: it is jsonb, written by this code today and by older code
// before it, and it can be hand-edited in the database. The undo path then cast
// each field straight into a writer parameter with `as never` — so the one path
// that writes values NOBODY re-entered was also the one path that validated
// nothing. A row a schema migration left half-shaped, or a record written by a
// version that spelled a field differently, was replayed verbatim into the
// sheet or the redline.
//
// So every recorded value is parsed here before it is written, and a value that
// cannot be parsed is REFUSED, never repaired and never written. That
// distinction matters on a contractual record: silently dropping a malformed
// viewport would undo an operation into a state that never existed, which is
// worse than telling the QS the undo cannot be trusted.

import { BadRequestError } from "../../../lib/errors.ts";
import type { OverlaySettingsV1 } from "./editor-overlay.ts";
import type { GeometrySpace, MarkupGeometry, MarkupStyle } from "../../drawing-markup/types.ts";
import type { SheetCalibration, SheetViewport } from "./types.ts";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const pair = (v: unknown): [number, number] | null =>
  Array.isArray(v) && v.length === 2 && finite(v[0]) && finite(v[1]) ? [v[0], v[1]] : null;

/** Exactly `n` finite numbers, or null. `every` does not narrow an array's element type. */
function numbers(value: unknown, n: number): number[] | null {
  if (!Array.isArray(value) || value.length !== n) return null;
  const out: number[] = [];
  for (const entry of value) {
    if (!finite(entry)) return null;
    out.push(entry);
  }
  return out;
}

/** What the undo could not put back, named so the refusal says which record. */
export class UnreadableAuditState extends BadRequestError {
  constructor(what: string) {
    super(
      `This edit cannot be undone: the ${what} it recorded can no longer be read, ` +
        "so putting it back would write a state that never existed. Correct the record by hand instead.",
    );
  }
}

export function readSheetCalibration(value: unknown): SheetCalibration | null {
  if (value === null || value === undefined) return null;
  if (!isObject(value) || !finite(value["mmPerPt"]) || value["mmPerPt"] <= 0) throw new UnreadableAuditState("sheet scale");
  if (typeof value["actor"] !== "string" || typeof value["time"] !== "string") throw new UnreadableAuditState("sheet scale");
  const from = pair(value["fromPt"]);
  const to = pair(value["toPt"]);
  return {
    mmPerPt: value["mmPerPt"],
    actor: value["actor"],
    time: value["time"],
    enteredDistance: finite(value["enteredDistance"]) ? value["enteredDistance"] : null,
    unit: typeof value["unit"] === "string" ? value["unit"] : null,
    ...(from ? { fromPt: from } : {}),
    ...(to ? { toPt: to } : {}),
  };
}

export function readViewports(value: unknown): SheetViewport[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) throw new UnreadableAuditState("drawing's viewports");
  return value.map((entry) => {
    if (!isObject(entry) || typeof entry["id"] !== "string" || typeof entry["label"] !== "string") {
      throw new UnreadableAuditState("drawing's viewports");
    }
    const box = numbers(entry["rect"], 4);
    if (!box) throw new UnreadableAuditState("drawing's viewports");
    const rect: [number, number, number, number] = [box[0]!, box[1]!, box[2]!, box[3]!];
    if (!finite(entry["scaleMmPerPt"]) || entry["scaleMmPerPt"] <= 0) throw new UnreadableAuditState("drawing's viewports");
    return {
      id: entry["id"],
      label: entry["label"],
      rect,
      scaleMmPerPt: entry["scaleMmPerPt"],
    };
  });
}

export function readOverlaySettings(value: unknown): OverlaySettingsV1 | null {
  if (value === null || value === undefined) return null;
  if (!isObject(value) || value["schemaVersion"] !== 1) throw new UnreadableAuditState("revision overlay");
  const { sourceSheetId, targetSheetId, sourceRevisionId, targetRevisionId, opacity, actor, time } = value;
  const ids = [sourceSheetId, targetSheetId, sourceRevisionId, targetRevisionId, actor, time];
  if (ids.some((id) => typeof id !== "string")) throw new UnreadableAuditState("revision overlay");
  if (!finite(opacity) || opacity < 0 || opacity > 1) throw new UnreadableAuditState("revision overlay");
  const raw = numbers(value["matrix"], 6);
  if (!raw) throw new UnreadableAuditState("revision overlay");
  const matrix: [number, number, number, number, number, number] = [raw[0]!, raw[1]!, raw[2]!, raw[3]!, raw[4]!, raw[5]!];
  const anchors = value["anchors"];
  if (!Array.isArray(anchors) || anchors.length !== 3) throw new UnreadableAuditState("revision overlay");
  const parsed = anchors.map((anchor) => {
    const source = isObject(anchor) ? pair(anchor["source"]) : null;
    const target = isObject(anchor) ? pair(anchor["target"]) : null;
    if (!source || !target) throw new UnreadableAuditState("revision overlay");
    return { source, target };
  });
  return {
    schemaVersion: 1,
    sourceSheetId: sourceSheetId as string,
    targetSheetId: targetSheetId as string,
    sourceRevisionId: sourceRevisionId as string,
    targetRevisionId: targetRevisionId as string,
    opacity,
    anchors: [parsed[0]!, parsed[1]!, parsed[2]!],
    matrix,
    actor: actor as string,
    time: time as string,
  };
}

const POINT_KINDS = new Set(["pin"]);

export function readMarkupGeometry(value: unknown): MarkupGeometry {
  if (!isObject(value) || typeof value["kind"] !== "string") throw new UnreadableAuditState("redline's shape");
  const kind = value["kind"];
  const point = (v: unknown): { x: number; y: number } | null =>
    isObject(v) && finite(v["x"]) && finite(v["y"]) ? { x: v["x"], y: v["y"] } : null;
  const raw = value["space"];
  const space: { space?: GeometrySpace } = raw === "points" || raw === "percent" ? { space: raw } : {};

  if (POINT_KINDS.has(kind)) {
    const at = point(value["at"]);
    if (!at) throw new UnreadableAuditState("redline's shape");
    return { kind: "pin", at, ...space };
  }
  if (kind === "pen") {
    const points = value["points"];
    if (!Array.isArray(points) || points.length < 2) throw new UnreadableAuditState("redline's shape");
    const mapped = points.map((p) => {
      const parsedPoint = point(p);
      if (!parsedPoint) throw new UnreadableAuditState("redline's shape");
      return parsedPoint;
    });
    return { kind: "pen", points: mapped, ...space };
  }
  if (kind === "cloud") {
    const rect = value["rect"];
    if (!isObject(rect) || !finite(rect["x"]) || !finite(rect["y"]) || !finite(rect["w"]) || !finite(rect["h"])) {
      throw new UnreadableAuditState("redline's shape");
    }
    return { kind: "cloud", rect: { x: rect["x"], y: rect["y"], w: rect["w"], h: rect["h"] }, ...space };
  }
  if (kind === "measure") {
    const a = point(value["a"]);
    const b = point(value["b"]);
    if (!a || !b) throw new UnreadableAuditState("redline's shape");
    return { kind: "measure", a, b, ...space };
  }
  throw new UnreadableAuditState("redline's shape");
}

export function readMarkupStyle(value: unknown): MarkupStyle | null {
  if (value === null || value === undefined) return null;
  if (!isObject(value)) throw new UnreadableAuditState("redline's pen");
  const style: MarkupStyle = {};
  if (value["color"] !== undefined) {
    if (typeof value["color"] !== "string") throw new UnreadableAuditState("redline's pen");
    style.color = value["color"];
  }
  if (value["strokeWidthPx"] !== undefined) {
    if (!finite(value["strokeWidthPx"]) || value["strokeWidthPx"] < 0) throw new UnreadableAuditState("redline's pen");
    style.strokeWidthPx = value["strokeWidthPx"];
  }
  return style;
}

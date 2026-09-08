import type { DwgDoc, DwgEntity } from "../dwg-takeoff/dwg.ts";
import type { GeoArc, GeoBlock, GeoClosedShape, GeoDimension, GeoDocument, GeoInsert, GeoLayer, GeoSegment, GeoText, GeoUnits, GeoUnreadable } from "./types.ts";

// DWG → GeoDocument. Only model space is converted: block definitions are
// catalogued (name, size, how often inserted) and paper-space layouts are
// counted as unreadable so nobody mistakes a title block for a wall.

const MODEL_SPACE = 2;
const PAPER_SPACE = 1;
const CLOSED_FLAG = 512;

// AutoCAD $INSUNITS codes that name a length unit.
const INSUNITS: Record<number, GeoUnits["unit"]> = { 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" };

const abs = (ref: number[] | undefined): number | null => (ref && ref.length ? (ref[ref.length - 1] ?? null) : null);
const handleOf = (e: DwgEntity): string => String(abs(e.handle) ?? "?");
const stripMtext = (v: string) =>
  v
    .replace(/\\[A-Za-z][^;]*;/g, "")
    .replace(/\\P/g, " ")
    .replace(/[{}]/g, "")
    .trim();

function circlePolygon(cx: number, cy: number, r: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Units come from the header when it says; otherwise from where the
// dimension values sit. A drawing dimensioned in the thousands is millimetres,
// one dimensioned in single digits is metres. Confidence follows the evidence.
export function inferUnits(header: DwgDoc["header"], dimensionValues: number[]): GeoUnits {
  const declared = header?.INSUNITS;
  if (declared !== undefined && declared !== null && INSUNITS[declared]) {
    return { unit: INSUNITS[declared]!, basis: "header", confidence: 0.95, note: `Header declares $INSUNITS=${declared}` };
  }
  const values = dimensionValues.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (values.length >= 3) {
    const median = values[values.length >> 1]!;
    const confidence = Math.min(0.9, 0.5 + values.length / 200);
    if (median >= 100 && median <= 50_000) {
      return { unit: "mm", basis: "dimensions", confidence, note: `${values.length} dimensions, median ${Math.round(median)} → millimetres` };
    }
    if (median >= 0.1 && median <= 50) {
      return { unit: "m", basis: "dimensions", confidence, note: `${values.length} dimensions, median ${median.toFixed(2)} → metres` };
    }
    if (median > 50 && median < 100) {
      return { unit: "cm", basis: "dimensions", confidence: confidence * 0.7, note: `${values.length} dimensions, median ${Math.round(median)} → centimetres (ambiguous band)` };
    }
  }
  return {
    unit: "mm",
    basis: "assumed",
    confidence: 0.3,
    note: values.length === 0 ? "No header unit and no dimensions; millimetres assumed" : `No header unit; ${values.length} dimensions gave no clear band; millimetres assumed`,
  };
}

export function fromDwg(doc: DwgDoc): GeoDocument {
  const entities = doc.entities;

  // block headers by handle, model-space header, xref flags
  const headers = new Map<number, { name: string; xref: boolean }>();
  let modelHeader: number | null = null;
  for (const e of entities) {
    if (e.object !== "BLOCK_HEADER") continue;
    const h = abs(e.handle);
    if (h === null) continue;
    const name = e.name ?? "";
    headers.set(h, { name, xref: Boolean(e.blkisxref || e.xref) });
    if (/^\*model_space$/i.test(name)) modelHeader = h;
  }

  // layer table: name + colour
  const layerColor = new Map<string, number | null>();
  for (const e of entities) {
    if (e.object === "LAYER" && e.name) layerColor.set(e.name, typeof e.color === "number" ? e.color : null);
  }

  // attributes grouped by the insert that owns them
  const attribsByOwner = new Map<number, Record<string, string>>();
  for (const e of entities) {
    if (e.entity !== "ATTRIB") continue;
    const owner = abs(e.ownerhandle);
    if (owner === null || !e.tag) continue;
    const map = attribsByOwner.get(owner) ?? {};
    map[e.tag] = e.text_value ?? "";
    attribsByOwner.set(owner, map);
  }

  const blockEntityCount = new Map<number, number>();
  const blockInsertCount = new Map<number, number>();
  const layerCount = new Map<string, number>();
  const unreadable = new Map<string, GeoUnreadable>();
  const bump = (what: string, note: string) => {
    const row = unreadable.get(what) ?? { what, count: 0, note };
    row.count += 1;
    unreadable.set(what, row);
  };

  // attributes are owned by their insert, so they inherit its space
  const modelInserts = new Set<number>();
  for (const e of entities) {
    if (e.entity !== "INSERT") continue;
    const owner = abs(e.ownerhandle);
    if (e.entmode === MODEL_SPACE || (owner !== null && owner === modelHeader)) {
      const h = abs(e.handle);
      if (h !== null) modelInserts.add(h);
    }
  }

  const segments: GeoSegment[] = [];
  const shapes: GeoClosedShape[] = [];
  const arcs: GeoArc[] = [];
  const inserts: GeoInsert[] = [];
  const texts: GeoText[] = [];
  const dimensions: GeoDimension[] = [];
  let paperSpace = 0;

  for (const e of entities) {
    if (!e.entity) continue;
    const owner = abs(e.ownerhandle);
    const inModel =
      e.entmode === MODEL_SPACE || (owner !== null && owner === modelHeader) || (e.entity === "ATTRIB" && owner !== null && modelInserts.has(owner));
    if (!inModel) {
      if (e.entmode === PAPER_SPACE) paperSpace++;
      else if (e.entmode === 0 && owner !== null) blockEntityCount.set(owner, (blockEntityCount.get(owner) ?? 0) + 1);
      continue;
    }
    const layer = doc.layerName(e);
    const id = handleOf(e);
    const color = typeof e.color === "number" ? e.color : null;
    const width = typeof e.linewt === "number" ? e.linewt : null;
    const count = () => layerCount.set(layer, (layerCount.get(layer) ?? 0) + 1);

    switch (e.entity) {
      case "LINE": {
        if (!e.start || !e.end) break;
        segments.push({ id, x1: e.start[0]!, y1: e.start[1]!, x2: e.end[0]!, y2: e.end[1]!, layer, width, color, fill: false, source: "LINE" });
        count();
        break;
      }
      case "LWPOLYLINE":
      case "POLYLINE_2D": {
        if (!e.points || e.points.length < 2) break;
        const closed = e.flag !== undefined && (e.flag & CLOSED_FLAG) !== 0;
        const pts = e.points.map((p) => [p[0]!, p[1]!]);
        for (let k = 1; k < pts.length; k++) {
          segments.push({ id: `${id}:${k}`, x1: pts[k - 1]![0]!, y1: pts[k - 1]![1]!, x2: pts[k]![0]!, y2: pts[k]![1]!, layer, width, color, fill: false, source: e.entity });
        }
        if (closed) {
          const last = pts[pts.length - 1]!;
          const first = pts[0]!;
          segments.push({ id: `${id}:close`, x1: last[0]!, y1: last[1]!, x2: first[0]!, y2: first[1]!, layer, width, color, fill: false, source: e.entity });
          shapes.push({ id, points: pts, layer, fill: false, kind: "polyline" });
        }
        count();
        break;
      }
      case "CIRCLE": {
        if (!e.center || e.radius === undefined) break;
        shapes.push({ id, points: circlePolygon(e.center[0]!, e.center[1]!, e.radius), layer, fill: false, kind: "circle" });
        count();
        break;
      }
      case "ARC": {
        if (!e.center || e.radius === undefined || e.start_angle === undefined || e.end_angle === undefined) break;
        arcs.push({ id, cx: e.center[0]!, cy: e.center[1]!, r: e.radius, startAngle: e.start_angle, endAngle: e.end_angle, layer });
        count();
        break;
      }
      case "HATCH":
      case "SOLID": {
        shapes.push({ id, points: e.points ? e.points.map((p) => [p[0]!, p[1]!]) : [], layer, fill: true, kind: "hatch" });
        count();
        break;
      }
      case "INSERT": {
        const bh = abs(e.block_header);
        const name = bh !== null ? (headers.get(bh)?.name ?? `block#${bh}`) : "unknown";
        if (bh !== null) blockInsertCount.set(bh, (blockInsertCount.get(bh) ?? 0) + 1);
        inserts.push({
          id,
          blockName: name,
          x: e.ins_pt?.[0] ?? 0,
          y: e.ins_pt?.[1] ?? 0,
          scale: [e.scale?.[0] ?? 1, e.scale?.[1] ?? 1],
          rotation: e.rotation ?? 0,
          layer,
          attributes: attribsByOwner.get(abs(e.handle) ?? -1) ?? {},
        });
        count();
        break;
      }
      case "TEXT":
      case "MTEXT":
      case "ATTRIB": {
        const raw = e.entity === "MTEXT" ? e.text : e.text_value;
        const value = raw ? (e.entity === "MTEXT" ? stripMtext(raw) : raw.trim()) : "";
        if (!value || !e.ins_pt) break;
        texts.push({
          id,
          text: value,
          x: e.ins_pt[0]!,
          y: e.ins_pt[1]!,
          height: e.height ?? null,
          layer,
          kind: e.entity === "TEXT" ? "text" : e.entity === "MTEXT" ? "mtext" : "attrib",
        });
        count();
        break;
      }
      default: {
        if (e.entity.startsWith("DIMENSION")) {
          if (e.act_measurement !== undefined && e.xline1_pt && e.xline2_pt) {
            dimensions.push({
              id,
              value: e.act_measurement,
              textOverride: e.user_text && e.user_text.trim() ? e.user_text.trim() : null,
              x1: e.xline1_pt[0]!,
              y1: e.xline1_pt[1]!,
              x2: e.xline2_pt[0]!,
              y2: e.xline2_pt[1]!,
              layer,
            });
            count();
          } else {
            bump(e.entity, "Dimension without measurement points");
          }
        } else if (e.entity === "ELLIPSE") bump("ELLIPSE", "Ellipses are not converted to geometry yet");
        else if (e.entity === "SPLINE") bump("SPLINE", "Splines are not converted to geometry yet");
        else if (e.entity.includes("PROXY")) bump(e.entity, "Proxy object from an add-on such as AutoCAD Architecture; its geometry is not readable");
        else if (e.entity === "POINT" || e.entity === "LEADER" || e.entity === "ATTDEF" || e.entity === "SEQEND" || e.entity === "VIEWPORT") {
          bump(e.entity, "Annotation, not measurable geometry");
        } else bump(e.entity, "Entity kind not converted");
      }
    }
  }

  if (paperSpace > 0) bump("paper space", `${paperSpace} entities on layouts (title blocks, viewports) are not measured`);
  for (const [h, info] of headers) {
    if (info.xref) bump("xref", `External reference "${info.name}" is not in this file; its geometry is missing`);
    void h;
  }

  const layers: GeoLayer[] = [...layerCount.entries()]
    .map(([name, count]) => ({ name, count, color: layerColor.get(name) ?? null }))
    .sort((a, b) => b.count - a.count);

  const blocks: GeoBlock[] = [...headers.entries()]
    .filter(([, info]) => !info.name.startsWith("*"))
    .map(([h, info]) => ({ name: info.name, inserts: blockInsertCount.get(h) ?? 0, entities: blockEntityCount.get(h) ?? 0 }))
    .filter((b) => b.inserts > 0 || b.entities > 0)
    .sort((a, b) => b.inserts - a.inserts);

  return {
    source: "dwg",
    units: inferUnits(doc.header, dimensions.map((d) => d.value)),
    space: "model",
    layers,
    blocks,
    segments,
    shapes,
    arcs,
    inserts,
    texts,
    dimensions,
    unreadable: [...unreadable.values()],
  };
}

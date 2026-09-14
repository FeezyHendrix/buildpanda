import { blockMembers, blockNameOf, handleOf, isModelSpace, ownerOf, type DwgDoc, type DwgEntity } from "./dwg.ts";

// A block reference is a drawing inside the drawing: a handed flat inserted
// twice, a door symbol, a title block. The measurement rules read lines,
// outlines and arcs, so every model-space INSERT is expanded into the
// entities it stands for, placed, scaled (a negative x scale mirrors) and
// rotated, and those virtual entities join the model space. Each one
// remembers the INSERT it came from, which is the object a reviewer can
// point at, and the values of the ATTRIBs the INSERT carries.

export const VIRTUAL_HANDLE_BASE = 0x40000000;
const MAX_DEPTH = 4;
const MAX_VIRTUAL = 400_000;

export interface Expansion {
  doc: DwgDoc;
  // synthetic handle → the INSERT it was expanded from
  origin: Map<number, number>;
  expanded: number;
  inserts: number;
  // block names left unexpanded and why
  skipped: string[];
}

interface Placement {
  x: number;
  y: number;
  sx: number;
  sy: number;
  cos: number;
  sin: number;
}

function place(p: Placement, pt: number[]): number[] {
  const x = pt[0]! * p.sx;
  const y = pt[1]! * p.sy;
  return [p.x + x * p.cos - y * p.sin, p.y + x * p.sin + y * p.cos];
}

// ATTRIB entities are owned by the INSERT they belong to.
export function attributesOf(insert: DwgEntity, byOwner: Map<number, DwgEntity[]>): Record<string, string> {
  const h = handleOf(insert);
  const out: Record<string, string> = {};
  if (h === null) return out;
  for (const a of byOwner.get(h) ?? []) {
    if (a.entity !== "ATTRIB" || !a.tag) continue;
    const value = (a.text_value ?? "").trim();
    if (value) out[a.tag] = value;
  }
  return out;
}

function transformed(e: DwgEntity, p: Placement): DwgEntity | null {
  const r = Math.abs(p.sx);
  switch (e.entity) {
    case "LINE":
      if (!e.start || !e.end) return null;
      return { ...e, start: place(p, e.start), end: place(p, e.end) };
    case "LWPOLYLINE":
    case "POLYLINE_2D":
      if (!e.points) return null;
      return { ...e, points: e.points.map((pt) => place(p, pt)) };
    case "CIRCLE":
      if (!e.center || e.radius === undefined) return null;
      return { ...e, center: place(p, e.center), radius: e.radius * r };
    case "ARC": {
      if (!e.center || e.radius === undefined) return null;
      const rot = Math.atan2(p.sin, p.cos);
      let start = e.start_angle ?? 0;
      let end = e.end_angle ?? Math.PI * 2;
      // a mirrored arc sweeps the other way: angles reflect about the y axis
      if (p.sx < 0) [start, end] = [Math.PI - end, Math.PI - start];
      if (p.sy < 0) [start, end] = [-end, -start];
      return { ...e, center: place(p, e.center), radius: e.radius * r, start_angle: start + rot, end_angle: end + rot };
    }
    case "TEXT":
    case "MTEXT":
      if (!e.ins_pt) return null;
      return { ...e, ins_pt: place(p, e.ins_pt), height: (e.height ?? 0) * r };
    default:
      return null;
  }
}

/** The model space with every INSERT expanded into the entities it places. */
export function expandInserts(doc: DwgDoc): Expansion {
  const entities = [...doc.entities];
  const origin = new Map<number, number>();
  const skipped = new Set<string>();
  const layerZero = new Set<number>();
  const byOwner = new Map<number, DwgEntity[]>();
  for (const e of doc.entities) {
    if (e.object === "LAYER" && e.name === "0") {
      const h = handleOf(e);
      if (h !== null) layerZero.add(h);
    }
    if (e.entity === "ATTRIB") {
      const o = ownerOf(e);
      if (o !== null) byOwner.set(o, [...(byOwner.get(o) ?? []), e]);
    }
  }
  let next = VIRTUAL_HANDLE_BASE;
  let inserts = 0;
  let expanded = 0;

  const expand = (insert: DwgEntity, outer: Placement | null, depth: number, root: number): void => {
    if (depth > MAX_DEPTH) return;
    const members = blockMembers(doc, insert);
    const name = blockNameOf(doc, insert) ?? "?";
    if (!members.length) return;
    if (/^\*[DAT]/i.test(name)) return; // anonymous dimension, hatch and table blocks draw themselves
    const ins = insert.ins_pt ?? [0, 0];
    const scale = insert.scale ?? [1, 1, 1];
    const rot = insert.rotation ?? 0;
    const local: Placement = { x: ins[0]!, y: ins[1]!, sx: scale[0] ?? 1, sy: scale[1] ?? 1, cos: Math.cos(rot), sin: Math.sin(rot) };
    const p: Placement = outer
      ? (() => {
          const [x, y] = place(outer, [local.x, local.y]);
          const angle = Math.atan2(outer.sin, outer.cos) + rot;
          return { x: x!, y: y!, sx: local.sx * outer.sx, sy: local.sy * outer.sy, cos: Math.cos(angle), sin: Math.sin(angle) };
        })()
      : local;
    for (const i of members) {
      const m = doc.entities[i]!;
      if (m.entity === "INSERT") {
        expand(m, p, depth + 1, root);
        continue;
      }
      const t = transformed(m, p);
      if (!t) continue;
      if (expanded >= MAX_VIRTUAL) {
        skipped.add(`${name} (entity cap reached)`);
        return;
      }
      const h = next++;
      origin.set(h, root);
      // a member on layer 0 takes the insert's layer, as AutoCAD draws it
      const memberLayer = m.layer && layerZero.has(m.layer[m.layer.length - 1]!) ? insert.layer : m.layer;
      entities.push({ ...t, handle: [0, 4, h, h], layer: memberLayer, entmode: 2, ownerhandle: insert.ownerhandle, insertHandle: root });
      expanded++;
    }
  };

  for (const e of doc.entities) {
    if (e.entity !== "INSERT" || !isModelSpace(doc, e)) continue;
    const h = handleOf(e);
    if (h === null) continue;
    if (e.blkisxref) {
      skipped.add(`${blockNameOf(doc, e) ?? "xref"} (external reference)`);
      continue;
    }
    e.attributes = attributesOf(e, byOwner);
    inserts++;
    expand(e, null, 0, h);
  }
  const out: DwgDoc = { ...doc, entities, layerName: doc.layerName };
  return { doc: out, origin, expanded, inserts, skipped: [...skipped] };
}

/** Evidence handles with the virtual ones replaced by the INSERT they came from. */
export function realHandles(handles: number[], origin: Map<number, number>): number[] {
  return [...new Set(handles.map((h) => origin.get(h) ?? h))];
}

import { extentOf, isModelSpace, textOf, type DwgDoc } from "./dwg.ts";
import { classifyDrawing, clusterDrawings, type Cluster } from "./clustering.ts";
import { elementOf } from "./taxonomy.ts";
import type { LayerMap, RegisterSheet, UnitsDecision } from "./types.ts";

// What a surveyor reads off a drawing before measuring anything: its title,
// its level, and which other drawings are the same floor repeated.

// A title is a short label that names the drawing; a specification note that
// happens to contain "plan" is not one, so titles are capped at 40 characters.
const TITLE = /\b(FLOOR\s*PLAN|ROOF\s*PLAN|SITE\s*(PLAN|LAYOUT)|LAYOUT\s*PLAN|PLAN\s+(AT|OF)\b|ELEVATION|(NORTH|SOUTH|EAST|WEST|FRONT|REAR|BACK|SIDE|LEFT|RIGHT)\s+VIEW|SECTION\s+[A-Z0-9]|DETAIL)\b/i;
const TITLE_MAX = 40;
const ELEVATION = /\bELEVATION\b|\b(NORTH|SOUTH|EAST|WEST|FRONT|REAR|BACK|SIDE|LEFT|RIGHT)\s+(VIEW|ELEVATION)\b/i;
const SECTION = /\bSECTION\s+[A-Z0-9]/i;
const ROOF_PLAN = /\bROOF\s*PLAN\b/i;
const SITE_PLAN = /\bSITE\s*(PLAN|LAYOUT)\b|\bLAYOUT\s*PLAN\b/i;
const FLOOR_PLAN = /\b(FLOOR|GROUND|FIRST|SECOND|THIRD|FOURTH|FIFTH|TYPICAL|BASEMENT|MEZZANINE|PENTHOUSE|\d{1,2}(?:ST|ND|RD|TH))\s+FLOOR\s*PLAN\b|\bFLOOR\s*PLAN\b/i;
// a level mark is signed ("+3450", "-150"); a bare number is a door or window tag
const LEVEL_MARK = /^([+-]\d{2,6})(?:\s+(.*))?$/;
const FLOOR_NAME = /\b(GROUND|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|\d{1,2}(?:ST|ND|RD|TH)|BASEMENT|MEZZANINE|PENTHOUSE|TYPICAL)\s+FLOOR\b/i;
const ROOM_WORD = /bed|toilet|bath|kitchen|living|lounge|dining|office|store|lobby|corridor|hall|laundry|garage|balcony|terrace|veranda|pantry|study|dressing|maid|wc|shw|shower|stair/i;

const ORDINAL_NAMES = ["Ground floor", "First floor", "Second floor", "Third floor", "Fourth floor", "Fifth floor", "Sixth floor", "Seventh floor", "Eighth floor", "Ninth floor", "Tenth floor"];

interface Draft extends Cluster {
  bounds: RegisterSheet["bounds"];
  labels: string[];
  textMembers: number[];
  kind: RegisterSheet["kind"];
  levelMm: number | null;
  levelName: string | null;
  title: string | null;
  fingerprint: Fingerprint;
}

interface TextAt {
  index: number;
  text: string;
  x: number;
  y: number;
  owner: number | null;
}

export function buildRegister(doc: DwgDoc, units: UnitsDecision, map: LayerMap): RegisterSheet[] {
  const clusters = clusterDrawings(doc, units.scaleToMm, { map });
  const texts = assignTexts(doc, clusters, units);
  const drafts = clusters.map((c) => draft(doc, c, units, map, texts));
  assignFloorNames(drafts);
  assignGroups(drafts);
  return finish(drafts, units);
}

// Every model-space text belongs to exactly one drawing: the cluster whose
// box contains it, else the nearest box within reach. Titles sit a few
// metres under a drawing and a level stack a few metres beside it, so the
// reach is 8 m; a label is never shared, so a section title cannot leak onto
// the plan beside it.
function assignTexts(doc: DwgDoc, clusters: Cluster[], units: UnitsDecision): TextAt[] {
  const reach = 8000 / units.scaleToMm;
  const out: TextAt[] = [];
  doc.entities.forEach((e, i) => {
    if (!isModelSpace(doc, e) || !e.ins_pt) return;
    const text = textOf(e);
    if (!text) return;
    const x = e.ins_pt[0]!;
    const y = e.ins_pt[1]!;
    let owner: number | null = null;
    let best = Infinity;
    for (const c of clusters) {
      const dx = Math.max(c.minX - x, 0, x - c.maxX);
      const dy = Math.max(c.minY - y, 0, y - c.maxY);
      const d = Math.hypot(dx, dy);
      if (d < best) {
        best = d;
        owner = c.id;
      }
    }
    out.push({ index: i, text, x, y, owner: best <= reach ? owner : null });
  });
  return out;
}

function draft(doc: DwgDoc, c: Cluster, units: UnitsDecision, map: LayerMap, texts: TextAt[]): Draft {
  // real extent from member geometry, but a single stray line (a grid or
  // section marker running off the drawing) must not swallow the neighbours:
  // a member longer than the drawing itself is ignored and growth beyond the
  // centroid box is capped at a tenth of its size
  const cx = c.maxX - c.minX;
  const cy = c.maxY - c.minY;
  const cap = { minX: c.minX - cx * 0.1, minY: c.minY - cy * 0.1, maxX: c.maxX + cx * 0.1, maxY: c.maxY + cy * 0.1 };
  const bounds = { minX: c.minX, minY: c.minY, maxX: c.maxX, maxY: c.maxY };
  for (const i of c.members) {
    const ext = extentOf(doc.entities[i]!);
    if (!ext) continue;
    if (ext.maxX - ext.minX > cx * 1.1 || ext.maxY - ext.minY > cy * 1.1) continue;
    bounds.minX = Math.max(cap.minX, Math.min(bounds.minX, ext.minX));
    bounds.minY = Math.max(cap.minY, Math.min(bounds.minY, ext.minY));
    bounds.maxX = Math.min(cap.maxX, Math.max(bounds.maxX, ext.maxX));
    bounds.maxY = Math.min(cap.maxY, Math.max(bounds.maxY, ext.maxY));
  }
  const labels: string[] = [];
  const textMembers: number[] = [];
  for (const t of texts) {
    if (t.owner !== c.id) continue;
    labels.push(t.text);
    textMembers.push(t.index);
  }

  const title = labels.filter((l) => l.length <= TITLE_MAX && TITLE.test(l)).sort((a, b) => b.length - a.length)[0] ?? null;
  const levels = levelMarks(labels);
  const roomLabels = labels.filter((l) => ROOM_WORD.test(l)).length;
  const kind = decideKind(doc, c, map, labels, levels, roomLabels);
  // a floor plan carries one dominant level mark; elevations and sections carry them all
  const levelMm = kind === "floor-plan" ? mode(levels.map((l) => l.mm)) : null;
  const named = levels.find((l) => l.mm === levelMm && l.name);
  const fromLabel = labels.map((l) => l.match(FLOOR_NAME)?.[0]).find(Boolean);
  const levelName = kind !== "floor-plan" ? null : (named?.name ?? (fromLabel ? capitalise(fromLabel) : null));

  return { ...c, bounds, labels, textMembers, kind, levelMm, levelName, title, fingerprint: fingerprint(doc, c, map, units) };
}

function decideKind(doc: DwgDoc, c: Cluster, map: LayerMap, labels: string[], levels: { mm: number }[], roomLabels: number): RegisterSheet["kind"] {
  const short = labels.filter((l) => l.length <= TITLE_MAX);
  const joined = short.join(" | ");
  const distinctLevels = new Set(levels.map((l) => l.mm)).size;
  // a plan repeats one level mark on every room; a section or elevation
  // stacks all the storeys' marks down one edge
  const stacked = distinctLevels >= 3;
  if (ELEVATION.test(joined) && stacked) return "elevation";
  if (SECTION.test(joined) && stacked) return "section";
  if (ROOF_PLAN.test(joined) || SITE_PLAN.test(joined)) return "unknown";
  if (FLOOR_PLAN.test(joined)) return "floor-plan";
  if (ELEVATION.test(joined)) return "elevation";
  if (SECTION.test(joined)) return "section";
  if (!stacked && roomLabels >= 3) return "floor-plan";
  if (stacked) return roomLabels >= 2 ? "section" : "elevation";
  const geo = classifyDrawing(doc, c, map);
  return geo === "floor-plan" || geo === "elevation" || geo === "detail" ? geo : "unknown";
}

function levelMarks(labels: string[]): { mm: number; name: string | null }[] {
  const out: { mm: number; name: string | null }[] = [];
  for (const l of labels) {
    const m = l.match(LEVEL_MARK);
    if (!m) continue;
    const mm = Number(m[1]);
    if (!Number.isFinite(mm)) continue;
    const rest = (m[2] ?? "").trim();
    // "+3450 FIRST FLOOR SLAB" names the floor; "+3450" alone does not
    const name = rest.match(FLOOR_NAME)?.[0] ?? (/(FLOOR|SLAB|LEVEL)/i.test(rest) ? rest : null);
    out.push({ mm, name: name ? capitalise(name.replace(/\s+(SLAB|LEVEL)$/i, "")) : null });
  }
  return out;
}

const capitalise = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();

function mode(values: number[]): number | null {
  if (!values.length) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
}

// Floors with a level mark but no floor name are named by rank: the lowest
// plan level is the ground floor, the next the first, and so on.
function assignFloorNames(drafts: Draft[]): void {
  const plans = drafts.filter((d) => d.kind === "floor-plan" && d.levelMm !== null);
  const levels = [...new Set(plans.map((d) => d.levelMm!))].sort((a, b) => a - b);
  for (const d of plans) {
    if (d.levelName) continue;
    const rank = levels.indexOf(d.levelMm!);
    d.levelName = ORDINAL_NAMES[rank] ?? `Level ${rank + 1}`;
  }
}

// The same floor drawn again has the same element counts and wall length.
// Group by that fingerprint; distinct level marks then confirm that the copies
// are different storeys and not one floor pasted twice.
const PRINT_KEYS = ["walls", "doors", "windows", "columns", "sanitary"] as const;

// The fingerprint counts what is measured: closed outlines and block inserts
// per element, wall segments, and wall length. Swing lines and hatch do not
// make a different floor.
function fingerprint(doc: DwgDoc, c: Cluster, map: LayerMap, units: UnitsDecision): Fingerprint {
  const counts: Record<string, number> = {};
  let wallLen = 0;
  for (const i of c.members) {
    const e = doc.entities[i]!;
    const el = elementOf(doc, e, map);
    const closed = e.entity === "LWPOLYLINE" && ((e.flag ?? 0) & 512) !== 0;
    if (el === "walls" || closed || e.entity === "INSERT") counts[el] = (counts[el] ?? 0) + 1;
    if (el === "walls" && e.start && e.end) wallLen += Math.hypot(e.end[0]! - e.start[0]!, e.end[1]! - e.start[1]!);
  }
  return { counts: PRINT_KEYS.map((k) => counts[k] ?? 0), wallM: (wallLen * units.scaleToMm) / 1000 };
}

interface Fingerprint {
  counts: number[];
  wallM: number;
}

// Two floors are the same floor when every element count and the wall length
// agree within 5 % (a ground floor gains an entrance step or a lobby door and
// is still the typical floor).
function sameFloor(a: Fingerprint, b: Fingerprint): boolean {
  const within = (x: number, y: number) => Math.abs(x - y) <= Math.max(1, 0.05 * Math.max(x, y));
  return a.counts.every((x, i) => within(x, b.counts[i]!)) && within(a.wallM, b.wallM);
}

function assignGroups(drafts: Draft[]): void {
  const lists: Draft[][] = [];
  for (const d of drafts) {
    if (d.kind !== "floor-plan") continue;
    const list = lists.find((l) => sameFloor(l[0]!.fingerprint, d.fingerprint));
    if (list) list.push(d);
    else lists.push([d]);
  }
  (drafts as (Draft & { group?: number; multiplier?: number; representative?: boolean })[]).forEach((d, idx) => {
    d.group = idx;
    d.multiplier = 1;
    d.representative = true;
  });
  let group = 0;
  for (const list of lists) {
    const distinct = new Set(list.map((d) => d.levelMm ?? Symbol())).size;
    // identical geometry at distinct levels is repetition; at the same level it
    // is one floor drawn twice and must not multiply
    const copies = distinct === list.length ? list.length : 1;
    list.sort((a, b) => (a.levelMm ?? 0) - (b.levelMm ?? 0));
    list.forEach((d, i) => {
      const t = d as Draft & { group: number; multiplier: number; representative: boolean };
      t.group = group;
      t.multiplier = i === 0 ? copies : 1;
      t.representative = copies === 1 || i === 0;
    });
    group++;
  }
}

function finish(drafts: Draft[], units: UnitsDecision): RegisterSheet[] {
  const order: Record<RegisterSheet["kind"], number> = { "floor-plan": 0, elevation: 1, section: 2, detail: 3, unknown: 4 };
  const sorted = [...drafts].sort((a, b) => order[a.kind] - order[b.kind] || (a.levelMm ?? 0) - (b.levelMm ?? 0) || b.count - a.count);
  const toM = units.scaleToMm / 1000;
  return sorted.map((d, i) => {
    const t = d as Draft & { group: number; multiplier: number; representative: boolean };
    const title =
      d.title ??
      (d.kind === "floor-plan" && d.levelName ? `${d.levelName} plan` : d.kind === "elevation" ? `Elevation ${i + 1}` : d.kind === "section" ? `Section ${i + 1}` : `Drawing ${i + 1}`);
    return {
      id: d.id,
      code: `DWG-${String(i + 1).padStart(2, "0")}`,
      title: capitaliseTitle(title),
      kind: d.kind,
      levelMm: d.levelMm,
      levelName: d.levelName,
      bounds: d.bounds,
      widthM: Math.round((d.bounds.maxX - d.bounds.minX) * toM * 10) / 10,
      heightM: Math.round((d.bounds.maxY - d.bounds.minY) * toM * 10) / 10,
      entityCount: d.count,
      group: t.group,
      multiplier: t.multiplier,
      representative: t.representative,
      labels: d.labels,
      members: d.members,
      textMembers: d.textMembers,
    };
  });
}

const capitaliseTitle = (v: string) => v.replace(/\s+/g, " ").replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

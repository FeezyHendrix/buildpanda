import { textOf, type DwgDoc } from "./dwg.ts";
import { fillRooms, type FillFailure, type RoomSeed } from "./room-fill.ts";
import { wallSegments, type WallSegment } from "./walls.ts";
import type { LayerMap, MeasuredItem, RegisterSheet, UnitsDecision } from "./types.ts";

// Room areas on a DWG come from a flood fill: the wall faces, the door leaves
// and swings, the window frames and the bridged wall openings make the mask;
// the room labels seed it. The architect's stated area, when written, is the check.

const STATED_AREA = /(\d{2,5}(?:\.\d+)?)\s*(?:SQ(?:UARE)?\.?\s*M(?:ETRES?|ETERS?)?|M2|M²|SQM)/i;
// "each flat occupies 163 square metres": the figure is per dwelling, not per floor
const PER_UNIT = /\b(each|per|every)\s+(flat|unit|apartment|dwelling|house)\b|\b(flat|unit|apartment)\s+(is|occupies|has)\b/i;
const KITCHEN = /\bkitchen\b/i;
const ROOM_WORD = /bed|toilet|bath|kitchen|living|lounge|dining|office|store|lobby|corridor|hall|laundry|garage|balcony|terrace|veranda|pantry|study|dressing|maid|^wc|shw|shower|utility|closet|foyer|porch|lift|stair|shop|ward|class|lab|gym|plant|duct/i;
// labels that never name a room: titles, notes, marks, tags, dimensions
const NOT_A_ROOM = /plan|elevation|section|view|detail|scale|note|level|slab|riser|schedule|legend|^[+-]?\d|^[wdc]-?\d{1,3}$|mm\b|\bm2\b|sq\.?\s*m/i;

export interface RoomResult {
  items: MeasuredItem[];
  totalM2: number;
  statedM2: number | null;
  statedText: string | null;
  // the stated figure applies to one dwelling; kitchens count the dwellings
  perUnit: boolean;
  units: number;
  // room labels the flood fill could not enclose, with the reason
  unmeasured: Array<{ name: string; why: FillFailure }>;
  // sum of the enclosed rooms' inner perimeters: a check on the wall lengths
  perimeterM: number;
}

/** How the flood-filled rooms compare with the architect's stated area. */
export function statedAreaNote(r: RoomResult, code: string): string | null {
  const missing = r.unmeasured.length ? ` Not measured: ${summarise(r.unmeasured)}.` : "";
  if (r.statedM2 === null || r.totalM2 <= 0) return missing ? `${code}:${missing}` : null;
  return compare(r, code) + missing;
}

function summarise(failures: Array<{ name: string; why: FillFailure }>): string {
  const tally = new Map<string, number>();
  for (const f of failures) {
    const key = `${f.name} (${f.why})`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return [...tally.entries()].map(([l, n]) => (n > 1 ? `${l} ×${n}` : l)).join(", ");
}

function compare(r: RoomResult, code: string): string {
  const stated = r.statedM2 ?? 0;
  const agree = (target: number) => Math.abs(r.totalM2 - target) / target <= 0.1;
  if (!r.perUnit) {
    const diff = Math.round((Math.abs(r.totalM2 - stated) / stated) * 100);
    return `${code}: rooms sum to ${r.totalM2} m²; sheet states ${stated} m² (${agree(stated) ? "agree" : `differ by ${diff}%`}).`;
  }
  const k = [1, 2, 3, 4, 5, 6].find((n) => agree(n * stated));
  if (k) return `${code}: rooms sum to ${r.totalM2} m²; sheet states ${stated} m² per flat, which fits ${k} flat${k > 1 ? "s" : ""} (${r.units} kitchen${r.units > 1 ? "s" : ""} labelled).`;
  const expected = stated * r.units;
  const diff = Math.round((Math.abs(r.totalM2 - expected) / expected) * 100);
  return `${code}: rooms sum to ${r.totalM2} m²; sheet states ${stated} m² per flat × ${r.units} labelled kitchen${r.units > 1 ? "s" : ""} = ${expected} m² (differ by ${diff}%; check the room labels).`;
}

/** Labels on the sheet that can name a room, at the centre of their text. */
export function roomSeeds(doc: DwgDoc, sheet: RegisterSheet, units: UnitsDecision): RoomSeed[] {
  const seeds: RoomSeed[] = [];
  for (const i of sheet.textMembers) {
    const e = doc.entities[i]!;
    const str = textOf(e)?.trim();
    if (!str || !e.ins_pt) continue;
    if (str.length > 30 || str === sheet.title || NOT_A_ROOM.test(str)) continue;
    if ((str.match(/[A-Za-z]/g) ?? []).length < 2) continue;
    const height = e.height ?? 250 / units.scaleToMm;
    seeds.push({ name: str, x: e.ins_pt[0]! + (height * 0.6 * str.length) / 2, y: e.ins_pt[1]! + height / 2, known: ROOM_WORD.test(str) });
  }
  return seeds;
}

export function measureRooms(doc: DwgDoc, sheet: RegisterSheet, walls: WallSegment[], seals: WallSegment[], units: UnitsDecision, map: LayerMap): RoomResult {
  // door leaves and swings only join the mask when a room leaks without
  // them: inside the mask they cut the swing out of the room
  const openings = wallSegments(doc, sheet, map, ["doors", "windows"]);
  const fill = fillRooms([...walls, ...seals], openings, roomSeeds(doc, sheet, units), sheet.bounds, units.scaleToMm);

  const stated = sheet.labels.map((l) => ({ l, m: l.match(STATED_AREA) })).find((x) => x.m);
  const statedM2 = stated ? Number(stated.m![1]) : null;
  const perUnit = stated ? PER_UNIT.test(stated.l) : false;
  const kitchens = sheet.labels.filter((l) => KITCHEN.test(l)).length;
  const totalM2 = Math.round(fill.rooms.reduce((s, r) => s + r.areaM2, 0) * 100) / 100;
  const check = statedM2 !== null ? `sheet states ${statedM2} m²${perUnit ? " per flat" : ""}` : "no stated area on the sheet";
  const agrees = statedM2 !== null && [1, 2, 3, 4, 5, 6].some((n) => Math.abs(totalM2 - n * statedM2) / (n * statedM2) <= 0.05);

  const items: MeasuredItem[] = fill.rooms.map((r) => {
    const shared = r.sharedWith.length > 0;
    const confidence = units.errorPct > 0.1 || !r.known || shared ? "low" : agrees ? "high" : "medium";
    const reason = shared ? `open plan: one enclosure with ${r.sharedWith.join(", ")}` : !r.known ? "label is not a known room name" : units.errorPct > 0.1 ? "units uncertain" : agrees ? "rooms sum to the stated area" : "room polygon from wall network";
    return {
      trade: "floor areas",
      description: `${r.name}${r.sharedWith.length ? ` (with ${r.sharedWith.join(", ")})` : ""} — net floor area`,
      quantity: r.areaM2,
      unit: "m2",
      confidence,
      basis: `Flood fill inside the wall faces from the "${r.name}" label on ${sheet.code} (${fill.cellMm} mm grid${r.sealed === "walls" ? "" : r.sealed === "openings" ? ", door and window geometry added to seal it" : ", gaps closed morphologically"})`,
      sheetId: sheet.id,
      evidence: [],
      // the traced fill, in drawing units: the room the figure was taken from
      ...(r.vertices.length >= 3 ? { shapes: [{ kind: "area" as const, vertices: r.vertices }] } : {}),
      reason,
      crossCheck: check,
    };
  });
  const perimeterM = Math.round(fill.rooms.reduce((s, r) => s + r.perimeterM, 0) * 100) / 100;
  return { items, totalM2, statedM2, statedText: stated?.l ?? null, perUnit, units: Math.max(1, kitchens), unmeasured: fill.unmeasured, perimeterM };
}

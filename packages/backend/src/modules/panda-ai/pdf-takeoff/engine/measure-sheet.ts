import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { openStoredFile } from "../../../../lib/file-storage.ts";
import { generateId } from "../../../../lib/ids.ts";
import type { MeasuredBoqItem, Segment, SheetKind } from "../types.ts";
import { MEASURED_AREAS_GROUP } from "../types.ts";
import type { extractSheet } from "./pdf-extract.ts";
import { clusterRegions, segmentsInRegion } from "./cluster.ts";
import {
  countDoorArcs,
  countTags,
  curvesInRegion,
  geometryFromWallPairs,
  measureRoomAreas,
  measureWalls,
  textsInRegion,
  wallConfidence,
} from "./measure.ts";
import { tagSignature, type PlanFingerprint } from "./fingerprint.ts";

// One sheet's worth of measurement, factored out of the full run so a single
// sheet can be re-read after a reviewer fixes its scale or type.
const DEFAULT_WALL_HEIGHT_M = 2.7;

export async function withTempFile<T>(storagePath: string, ext: string, fn: (file: string) => Promise<T>): Promise<T> {
  const file = path.join(os.tmpdir(), `${generateId("pcg")}.${ext}`);
  const stream = await openStoredFile(storagePath);
  await pipeline(stream as Readable, createWriteStream(file));
  try {
    return await fn(file);
  } finally {
    await fs.rm(file, { force: true });
  }
}

const SHEET_TITLE_KINDS: [RegExp, SheetKind][] = [
  [/floor\s*plan|ground\s*floor|first\s*floor|typical\s*floor/i, "floor-plan"],
  [/elevation/i, "elevation"],
  [/section/i, "section"],
  [/schedule/i, "schedule"],
  [/detail/i, "detail"],
];

export function classifySheet(texts: { str: string }[], hasDoorArcs: boolean, hasRoomLabels: boolean): {
  kind: SheetKind;
  title: string | null;
} {
  const joined = texts.map((t) => t.str);
  let title: string | null = null;
  let kind: SheetKind = "unknown";
  for (const [pattern, k] of SHEET_TITLE_KINDS) {
    const hit = joined.find((s) => pattern.test(s) && s.length < 80);
    if (hit) {
      title = hit;
      kind = k;
      break;
    }
  }
  if (kind === "unknown" && (hasDoorArcs || hasRoomLabels)) kind = "floor-plan";
  return { kind, title };
}

export interface SheetMeasurement {
  items: MeasuredBoqItem[];
  fingerprint: PlanFingerprint | null;
}

// One region = one drawing. Measure only floor-plan-looking regions, and only
// the largest one per sheet — repeated plans on a sheet must not multiply
// quantities; the QS duplicates verified items per floor in review instead.
export function regionShareOfSheet(
  region: { minX: number; minY: number; maxX: number; maxY: number },
  segments: Segment[],
): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of segments) {
    minX = Math.min(minX, s.x1, s.x2);
    maxX = Math.max(maxX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
    maxY = Math.max(maxY, s.y1, s.y2);
  }
  const sheetArea = (maxX - minX) * (maxY - minY);
  if (sheetArea <= 0) return 1;
  return ((region.maxX - region.minX) * (region.maxY - region.minY)) / sheetArea;
}

export function measureSheetRegions(
  extracted: Awaited<ReturnType<typeof extractSheet>>,
  mmPerPt: number,
  calibrationConfidence: number,
  pageNumber: number,
  sheetLabel: string,
  roomsAsItems = false,
): SheetMeasurement {
  const regions = clusterRegions(extracted, mmPerPt);
  const items: MeasuredBoqItem[] = [];
  if (regions.length === 0) return { items, fingerprint: null };

  const primary = regions[0]!;
  const regionSegments = segmentsInRegion(extracted.segments, primary);
  const regionTexts = textsInRegion(extracted.texts, primary);
  const regionCurves = curvesInRegion(extracted.curves, primary);

  // If the isolated region still fills almost the whole sheet, envelope
  // isolation failed (walls are being measured over title block, notes and
  // dimension lines). Emit the wall item as provisional — a null-quantity sum
  // for manual takeoff — rather than silently billing a wrong contract figure.
  const envelopeUntrustworthy = regionShareOfSheet(primary, extracted.segments) >= 0.85;

  const walls = measureWalls(regionSegments, mmPerPt);
  if (walls.centrelineM > 0) {
    const grossM2 = Math.round(walls.centrelineM * DEFAULT_WALL_HEIGHT_M * 100) / 100;
    items.push({
      elementGroup: "Internal and external walls",
      workSection: { code: "F10", title: "BRICK/BLOCK WALLING" },
      specNote: "Sandcrete block walls; cement mortar (1:6); wall height assumed 2.70m pending elevations.",
      code: "F10/125",
      description: "Hollow sandcrete blockwall bedded and jointed in cement and sand mortar (1:6); walls; 225mm thick; skin of hollow walls; laid in stretcher bond",
      unit: "m2",
      qtyGross: grossM2,
      deductions: [],
      qty: grossM2,
      confidence: envelopeUntrustworthy ? "low" : wallConfidence(walls.pairs.length, calibrationConfidence),
      measurementBasis: envelopeUntrustworthy
        ? `Building could not be isolated from the sheet (measured extent fills the whole drawing); wall quantity left provisional for manual takeoff (${sheetLabel})`
        : `${walls.centrelineM.toFixed(1)}m centreline from ${walls.pairs.length} parallel wall pairs x ${DEFAULT_WALL_HEIGHT_M}m assumed height (${sheetLabel})`,
      geometries: geometryFromWallPairs(walls.pairs),
      pageNumber,
      provisional: envelopeUntrustworthy,
    });
  }

  const doors = countDoorArcs(regionCurves, mmPerPt);
  const tags = countTags(regionTexts);
  const toM = mmPerPt / 1000;
  const fingerprint: PlanFingerprint = {
    pageNumber,
    centrelineM: walls.centrelineM,
    wallPairs: walls.pairs.length,
    widthM: Math.round((primary.maxX - primary.minX) * toM * 10) / 10,
    heightM: Math.round((primary.maxY - primary.minY) * toM * 10) / 10,
    doorArcs: doors.count,
    tagSignature: tagSignature(tags),
  };

  if (tags.doors.size > 0) {
    for (const [tag, occurrences] of [...tags.doors.entries()].sort()) {
      items.push({
        elementGroup: "Doors",
        workSection: { code: "L20", title: "DOORS/SHUTTERS/HATCHES" },
        specNote: "Door types per architect's door schedule.",
        code: "L20",
        description: `Door type ${tag}; as door schedule`,
        unit: "nr",
        qtyGross: occurrences.length,
        deductions: [],
        qty: occurrences.length,
        confidence: "high",
        measurementBasis: `${occurrences.length} "${tag}" tags on ${sheetLabel}${doors.count ? `; ${doors.count} swing arcs on sheet as cross-check` : ""}`,
        geometries: [
          {
            kind: "count",
            vertices: occurrences.map((t) => [t.x, t.y]),
            quantity: occurrences.length,
            unit: "nr",
          },
        ],
        pageNumber,
      });
    }
  } else if (doors.count > 0) {
    items.push({
      elementGroup: "Doors",
      workSection: { code: "L20", title: "DOORS/SHUTTERS/HATCHES" },
      specNote: null,
      code: "L20",
      description: "Doors; type not tagged on plan — confirm against door schedule",
      unit: "nr",
      qtyGross: doors.count,
      deductions: [],
      qty: doors.count,
      confidence: "low",
      measurementBasis: `${doors.count} door-swing arcs (r 600-1200mm) on ${sheetLabel}`,
      geometries: [{ kind: "count", vertices: doors.centres, quantity: doors.count, unit: "nr" }],
      pageNumber,
    });
  }
  for (const [tag, occurrences] of [...tags.windows.entries()].sort()) {
    items.push({
      elementGroup: "Windows",
      workSection: { code: "L11", title: "WINDOWS/ROOFLIGHTS/SCREENS" },
      specNote: "Window types per architect's window schedule.",
      code: "L11",
      description: `Window type ${tag}; as window schedule`,
      unit: "nr",
      qtyGross: occurrences.length,
      deductions: [],
      qty: occurrences.length,
      confidence: "high",
      measurementBasis: `${occurrences.length} "${tag}" tags on ${sheetLabel}`,
      geometries: [
        { kind: "count", vertices: occurrences.map((t) => [t.x, t.y]), quantity: occurrences.length, unit: "nr" },
      ],
      pageNumber,
    });
  }

  const rooms = measureRoomAreas(regionSegments, extracted.texts, primary, mmPerPt);
  const totalFloorM2 = Math.round(rooms.reduce((s, r) => s + r.areaM2, 0) * 100) / 100;
  // Areas-only runs want each space on its own line — "kitchen 14.2 m²" — not
  // one screed item with the rooms folded into its description.
  if (roomsAsItems) {
    for (const room of rooms) {
      items.push({
        elementGroup: MEASURED_AREAS_GROUP,
        workSection: { code: "AREA", title: "MEASURED FLOOR AREAS BY SPACE" },
        specNote: "Net floor area inside the wall enclosure, measured per labelled space.",
        code: null,
        description: `${room.name} — floor area`,
        unit: "m2",
        qtyGross: room.areaM2,
        deductions: [],
        qty: room.areaM2,
        confidence: "high",
        measurementBasis: `Flood-fill from the "${room.name}" label on ${sheetLabel}`,
        geometries: [{ kind: "count" as const, vertices: [room.seed], quantity: room.areaM2, unit: "m2" }],
        pageNumber,
      });
    }
  } else if (rooms.length > 0) {
    items.push({
      elementGroup: "Floor finishings",
      workSection: { code: "M10", title: "SAND CEMENT SCREEDS/TOPPINGS" },
      specNote: "Floor areas measured room-by-room from wall enclosure; finishes to specification.",
      code: "M10",
      description: `Cement/sand screeded beds to floors (${rooms.length} rooms: ${rooms
        .slice(0, 6)
        .map((r) => r.name)
        .join(", ")}${rooms.length > 6 ? "…" : ""})`,
      unit: "m2",
      qtyGross: totalFloorM2,
      deductions: [],
      qty: totalFloorM2,
      confidence: "low",
      measurementBasis: `Flood-fill room areas from ${rooms.length} room labels on ${sheetLabel}`,
      geometries: rooms.map((r) => ({
        kind: "count" as const,
        vertices: [r.seed],
        quantity: r.areaM2,
        unit: "m2",
      })),
      pageNumber,
    });
  }

  for (const item of items) item.scope = "per-floor";
  return { items, fingerprint };
}


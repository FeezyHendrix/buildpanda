import type { Confidence, MeasuredBoqItem } from "../types.ts";
import { MEASURED_AREAS_GROUP } from "../types.ts";
import type { DocumentContext } from "./document-context.ts";
import { geometryFromWallPairs } from "./measure.ts";
import type { RegionMeasurement } from "./region-measure.ts";

// Turns one measured region into bill lines. Every line states how it was
// measured and, when it is not high confidence, exactly why: the reviewer
// reads the reason, not a score.

export interface ItemContext {
  document: DocumentContext;
  // calibration came from dimension strings and agreed with a standard scale
  scaleTrusted: boolean;
  scaleNote: string;
  envelopeUntrustworthy: boolean;
  pageNumber: number;
  sheetLabel: string;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function decide(reasons: string[]): { confidence: Confidence; confidenceReason: string | null } {
  return reasons.length ? { confidence: "low", confidenceReason: reasons.join("; ") } : { confidence: "high", confidenceReason: null };
}

function baseReasons(ctx: ItemContext): string[] {
  const reasons: string[] = [];
  if (!ctx.scaleTrusted) reasons.push(ctx.scaleNote);
  if (ctx.envelopeUntrustworthy) reasons.push("building could not be isolated from the sheet");
  return reasons;
}

export function wallItems(m: RegionMeasurement, ctx: ItemContext): MeasuredBoqItem[] {
  const { document } = ctx;
  const buckets = new Map<number, number[]>();
  m.walls.pairs.forEach((p, i) => {
    const key = Math.round(p.gapMm / 25) * 25;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  });
  const items: MeasuredBoqItem[] = [];
  for (const [thicknessMm, pairIdx] of [...buckets.entries()].sort((a, b) => b[0] - a[0])) {
    const pairs = pairIdx.map((i) => m.walls.pairs[i]!);
    const lengthM = r2(pairs.reduce((s, p) => s + p.lengthM, 0));
    if (lengthM <= 0) continue;
    const grossM2 = r2(lengthM * document.storeyHeightM);
    const openings = m.openings.filter((o) => pairIdx.includes(o.pair));
    const doors = openings.filter((o) => o.kind === "door");
    const windows = openings.filter((o) => o.kind === "window");
    const unknown = openings.filter((o) => o.kind === "unknown");
    const deductions: { label: string; qty: number }[] = [];
    const doorM2 = r2(doors.reduce((s, o) => s + (o.widthMm / 1000) * document.doorHeightM, 0));
    if (doorM2 > 0) deductions.push({ label: `${doors.length} door openings x ${document.doorHeightM}m high (${document.doorHeightBasis})`, qty: doorM2 });
    const windowM2 = r2(windows.reduce((s, o) => s + (o.widthMm / 1000) * document.windowHeightM, 0));
    if (windowM2 > 0) deductions.push({ label: `${windows.length} window openings x ${document.windowHeightM}m high (${document.windowHeightBasis})`, qty: windowM2 });
    const qty = r2(grossM2 - doorM2 - windowM2);

    const reasons = baseReasons(ctx);
    if (document.storeyHeightBasis === "assumed") reasons.push(`wall height assumed ${document.storeyHeightM}m (no level marks found)`);
    if (!m.dimensionCheck.ok) reasons.push(m.dimensionCheck.note);
    if (unknown.length) reasons.push(`${unknown.length} openings of unknown type not deducted`);
    if (pairs.length < 2) reasons.push("a single wall pair");
    const heightNote = document.storeyHeightBasis === "level-marks" ? `${document.storeyHeightM}m storey height from level marks` : `${document.storeyHeightM}m assumed height`;
    items.push({
      elementGroup: "Internal and external walls",
      workSection: { code: "F10", title: "BRICK/BLOCK WALLING" },
      specNote: `Sandcrete block walls; cement mortar (1:6); ${heightNote}.`,
      code: "F10/125",
      description: `Hollow sandcrete blockwall bedded and jointed in cement and sand mortar (1:6); walls; ${thicknessMm}mm thick; laid in stretcher bond`,
      unit: "m2",
      qtyGross: grossM2,
      deductions,
      qty: ctx.envelopeUntrustworthy ? qty : qty,
      ...decide(reasons),
      measurementBasis: ctx.envelopeUntrustworthy
        ? `Building could not be isolated from the sheet (measured extent fills the whole drawing); wall quantity left provisional for manual takeoff (${ctx.sheetLabel})`
        : `${lengthM}m centreline from ${pairs.length} parallel wall pairs at ${thicknessMm}mm x ${heightNote}; ${m.dimensionCheck.note} (${ctx.sheetLabel})`,
      geometries: geometryFromWallPairs(pairs),
      pageNumber: ctx.pageNumber,
      provisional: ctx.envelopeUntrustworthy,
    });
  }
  return items;
}

export function doorItems(m: RegionMeasurement, ctx: ItemContext): MeasuredBoqItem[] {
  const arcs = m.doors.count;
  const tagged = [...m.tags.doors.values()].reduce((s, l) => s + l.length, 0);
  const crossChecks: string[] = [];
  if (arcs > 0 && m.leaves === arcs) crossChecks.push(`${m.leaves} leaf lines match the swings`);
  if (arcs > 0 && tagged === arcs) crossChecks.push(`${tagged} D-tags match the swings`);
  const reasons = baseReasons(ctx);
  if (arcs === 0) reasons.push("no door swings found; count from tags only");
  else if (crossChecks.length === 0) reasons.push(`swings ${arcs}, leaf lines ${m.leaves}, tags ${tagged} disagree`);
  const decision = decide(reasons);
  const items: MeasuredBoqItem[] = [];
  if (m.tags.doors.size > 0 && (arcs === 0 || tagged === arcs)) {
    for (const [tag, occurrences] of [...m.tags.doors.entries()].sort()) {
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
        ...decision,
        measurementBasis: `${occurrences.length} "${tag}" tags on ${ctx.sheetLabel}${arcs ? `; ${arcs} swing arcs as cross-check` : ""}`,
        geometries: [{ kind: "count", vertices: occurrences.map((t) => [t.x, t.y]), quantity: occurrences.length, unit: "nr" }],
        pageNumber: ctx.pageNumber,
      });
    }
    return items;
  }
  if (arcs === 0) return items;
  const widths = [...new Set(m.doors.radiiMm.map((r) => Math.round(r / 50) * 50))].sort((a, b) => a - b);
  items.push({
    elementGroup: "Doors",
    workSection: { code: "L20", title: "DOORS/SHUTTERS/HATCHES" },
    specNote: null,
    code: "L20",
    description: `Doors; ${widths.join("/")}mm leaf${m.tags.doors.size ? "; tags disagree with swings — confirm against door schedule" : "; type not tagged on plan — confirm against door schedule"}`,
    unit: "nr",
    qtyGross: arcs,
    deductions: [],
    qty: arcs,
    ...decision,
    measurementBasis: `${arcs} door-swing arcs (r 600-1200mm) on ${ctx.sheetLabel}${crossChecks.length ? `; ${crossChecks.join("; ")}` : ""}`,
    geometries: [{ kind: "count", vertices: m.doors.centres, quantity: arcs, unit: "nr" }],
    pageNumber: ctx.pageNumber,
  });
  return items;
}

export function windowItems(m: RegionMeasurement, ctx: ItemContext): MeasuredBoqItem[] {
  const frames = m.windows.length;
  const nonDoorGaps = m.openings.filter((o) => o.kind !== "door").length;
  const tagged = [...m.tags.windows.values()].reduce((s, l) => s + l.length, 0);
  const reasons = baseReasons(ctx);
  const agree = frames > 0 && (frames === nonDoorGaps || frames === tagged);
  if (frames === 0) reasons.push("no window frames found on plan; count from tags only");
  else if (!agree) reasons.push(`window frames ${frames}, wall openings without a door ${nonDoorGaps}, tags ${tagged} disagree`);
  const decision = decide(reasons);
  const items: MeasuredBoqItem[] = [];
  if (m.tags.windows.size > 0 && (frames === 0 || tagged === frames)) {
    for (const [tag, occurrences] of [...m.tags.windows.entries()].sort()) {
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
        ...decision,
        measurementBasis: `${occurrences.length} "${tag}" tags on ${ctx.sheetLabel}${frames ? `; ${frames} frames on plan as cross-check` : ""}`,
        geometries: [{ kind: "count", vertices: occurrences.map((t) => [t.x, t.y]), quantity: occurrences.length, unit: "nr" }],
        pageNumber: ctx.pageNumber,
      });
    }
    return items;
  }
  if (frames === 0) return items;
  const widths = [...new Set(m.windows.map((w) => Math.round(w.widthMm / 50) * 50))].sort((a, b) => a - b);
  items.push({
    elementGroup: "Windows",
    workSection: { code: "L11", title: "WINDOWS/ROOFLIGHTS/SCREENS" },
    specNote: null,
    code: "L11",
    description: `Windows; ${widths.join("/")}mm wide; type not tagged on plan — confirm against window schedule`,
    unit: "nr",
    qtyGross: frames,
    deductions: [],
    qty: frames,
    ...decision,
    measurementBasis: `${frames} window frames drawn in external walls on ${ctx.sheetLabel}; ${nonDoorGaps} wall openings without a door swing as cross-check`,
    geometries: [{ kind: "count", vertices: m.windows.map((w) => [w.cx, w.cy]), quantity: frames, unit: "nr" }],
    pageNumber: ctx.pageNumber,
  });
  return items;
}

export function columnItems(m: RegionMeasurement, ctx: ItemContext): MeasuredBoqItem[] {
  const { count, griddedShare, centres } = m.columns;
  if (count === 0) return [];
  const reasons = baseReasons(ctx);
  if (count < 4) reasons.push("fewer than four columns: no grid to confirm them");
  else if (griddedShare < 0.75) reasons.push(`only ${Math.round(griddedShare * 100)}% of the squares sit on a column grid`);
  return [
    {
      elementGroup: "Frame",
      workSection: { code: "E10", title: "IN SITU CONCRETE" },
      specNote: "Reinforced concrete columns; sizes per structural drawings.",
      code: "E10",
      description: "Reinforced concrete columns; as shown on plan — confirm size and reinforcement against structural drawings",
      unit: "nr",
      qtyGross: count,
      deductions: [],
      qty: count,
      ...decide(reasons),
      measurementBasis: `${count} closed square outlines (150-800mm) on ${ctx.sheetLabel}; ${Math.round(griddedShare * 100)}% aligned on a grid`,
      geometries: [{ kind: "count", vertices: centres, quantity: count, unit: "nr" }],
      pageNumber: ctx.pageNumber,
    },
  ];
}

export function roomItems(m: RegionMeasurement, ctx: ItemContext, roomsAsItems: boolean): MeasuredBoqItem[] {
  const { rooms, unfilled } = m.rooms;
  if (rooms.length === 0) return [];
  const totalM2 = r2(rooms.reduce((s, r) => s + r.areaM2, 0));
  const reasons = baseReasons(ctx);
  if (unfilled.length) reasons.push(`${unfilled.length} room labels could not be filled: ${unfilled.slice(0, 8).join(", ")}${unfilled.length > 8 ? "…" : ""}`);
  if (!m.areaCheck.ok) reasons.push(m.areaCheck.note);
  const decision = decide(reasons);
  if (roomsAsItems) {
    return rooms.map((room) => ({
      elementGroup: MEASURED_AREAS_GROUP,
      workSection: { code: "AREA", title: "MEASURED FLOOR AREAS BY SPACE" },
      specNote: "Net floor area inside the wall enclosure, measured per labelled space.",
      code: null,
      description: `${room.name} — floor area`,
      unit: "m2",
      qtyGross: room.areaM2,
      deductions: [],
      qty: room.areaM2,
      confidence: room.sealed ? "low" : decision.confidence,
      confidenceReason: room.sealed ? "room only closed after sealing an opening wider than its door" : decision.confidenceReason,
      measurementBasis: `Flood-fill from the "${room.name}" label on ${ctx.sheetLabel}`,
      geometries: [{ kind: "count" as const, vertices: [room.seed], quantity: room.areaM2, unit: "m2" }],
      pageNumber: ctx.pageNumber,
    }));
  }
  return [
    {
      elementGroup: "Floor finishings",
      workSection: { code: "M10", title: "SAND CEMENT SCREEDS/TOPPINGS" },
      specNote: "Floor areas measured room-by-room from wall enclosure; finishes to specification.",
      code: "M10",
      description: `Cement/sand screeded beds to floors (${rooms.length} rooms: ${rooms
        .slice(0, 6)
        .map((r) => r.name)
        .join(", ")}${rooms.length > 6 ? "…" : ""})`,
      unit: "m2",
      qtyGross: totalM2,
      deductions: [],
      qty: totalM2,
      ...decision,
      measurementBasis: `Flood-fill room areas from ${rooms.length} room labels on ${ctx.sheetLabel}; ${m.areaCheck.note}${unfilled.length ? `; unfilled labels: ${unfilled.join(", ")}` : ""}`,
      geometries: rooms.map((r) => ({ kind: "count" as const, vertices: [r.seed], quantity: r.areaM2, unit: "m2" })),
      pageNumber: ctx.pageNumber,
    },
  ];
}

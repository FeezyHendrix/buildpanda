import { buildPlan, resetIds, type OpeningStyleHooks, type PlanSpec } from "./plan.ts";
import { scheduleSheet } from "./schedule.ts";
import type { Family, Line, PlanShape, Primitive, Sheet, Text, Truth, TruthElement, TruthRoom, TruthSheet, WallStyle } from "./types.ts";

// The building families the benchmark covers, from a three-bed bungalow to a
// twenty-storey tower. Each family yields plan sheets plus an elevation and a
// section, laid out side by side in one model space with wide gutters, the way
// architects issue a whole building in a single DWG.

const GUTTER_MM = 12_000;
const STOREY_M = 3.0;
const GROUND_LEVEL_MM = 450;

interface FamilyBuild {
  sheets: Sheet[];
  truth: Omit<Truth, "convention">;
  // width of the plan in mm, for the mirror convention
  planWidthMm: number;
}

export interface FamilyOptions {
  hooks: OpeningStyleHooks;
  walls: WallStyle;
  shape: PlanShape;
  doorMm?: number;
  windowMm?: number;
  windowHeadMm?: number;
  // add a door and window schedule sheet
  schedule?: boolean;
}

// The notch that turns each family's rectangle into an L: the top-right cells.
const NOTCH: Record<Family, Array<[number, number]>> = {
  bungalow: [[2, 2]],
  duplex: [[2, 2]],
  block4: [[2, 4], [2, 5]],
  tower20: [[4, 4], [4, 3], [3, 4]],
};

function levelText(storey: number): string {
  const mm = GROUND_LEVEL_MM + storey * STOREY_M * 1000;
  const name = ["GROUND FLOOR LEVEL", "FIRST FLOOR SLAB", "SECOND FLOOR SLAB", "THIRD FLOOR SLAB"][storey] ?? `LEVEL ${storey}`;
  return `+${mm} ${name}`;
}

function elevationSheet(id: string, widthMm: number, storeys: number, windowsPerStorey: number, originX: number, win: { w: number; h: number }): Sheet {
  const totalH = storeys * STOREY_M * 1000 + 1200;
  const prims: Primitive[] = [];
  let n = 0;
  const line = (x1: number, y1: number, x2: number, y2: number, heavy = false): Line => ({ kind: "line", id: `${id}_l${++n}`, layer: "wall", x1, y1, x2, y2, heavy });
  prims.push(line(0, 0, widthMm, 0, true), line(widthMm, 0, widthMm, totalH, true), line(widthMm, totalH, 0, totalH, true), line(0, totalH, 0, 0, true));
  for (let s = 0; s <= storeys; s++) {
    const y = s * STOREY_M * 1000;
    prims.push(line(0, y, widthMm, y));
    const label: Text = { kind: "text", id: `${id}_lv${s}`, layer: "text", x: widthMm + 900, y, height: 250, text: s < storeys ? levelText(s) : `+${GROUND_LEVEL_MM + storeys * STOREY_M * 1000} ROOF LEVEL` };
    prims.push(label);
    if (s < storeys) {
      const pitch = widthMm / (windowsPerStorey + 1);
      for (let w = 1; w <= windowsPerStorey; w++) {
        const cx = w * pitch;
        const hw = win.w / 2;
        prims.push({ kind: "polyline", id: `${id}_w${s}_${w}`, layer: "window", closed: true, points: [[cx - hw, y + 900], [cx + hw, y + 900], [cx + hw, y + 900 + win.h], [cx - hw, y + 900 + win.h]] });
      }
    }
  }
  prims.push({ kind: "text", id: `${id}_ttl`, layer: "text", x: 0, y: -3200, height: 450, text: "NORTH ELEVATION" });
  return { id, kind: "elevation", title: "NORTH ELEVATION", level: null, originX, originY: 0, primitives: prims };
}

function sectionSheet(id: string, depthMm: number, storeys: number, originX: number): Sheet {
  const totalH = storeys * STOREY_M * 1000 + 1200;
  const prims: Primitive[] = [];
  let n = 0;
  const line = (x1: number, y1: number, x2: number, y2: number, heavy = false): Line => ({ kind: "line", id: `${id}_l${++n}`, layer: "wall", x1, y1, x2, y2, heavy });
  prims.push(line(0, 0, depthMm, 0, true), line(depthMm, 0, depthMm, totalH, true), line(depthMm, totalH, 0, totalH, true), line(0, totalH, 0, 0, true));
  for (let s = 0; s <= storeys; s++) {
    const y = s * STOREY_M * 1000;
    prims.push(line(0, y, depthMm, y, true), line(0, y + 150, depthMm, y + 150, true));
    prims.push({ kind: "text", id: `${id}_lv${s}`, layer: "text", x: depthMm + 900, y, height: 250, text: s < storeys ? levelText(s) : `+${GROUND_LEVEL_MM + storeys * STOREY_M * 1000} ROOF LEVEL` });
  }
  prims.push({ kind: "text", id: `${id}_st`, layer: "text", x: 1000, y: 1500, height: 220, text: "19 NOS RISERS OF 158MM EACH AND TREADS OF 275MM" });
  prims.push({ kind: "text", id: `${id}_ttl`, layer: "text", x: 0, y: -3200, height: 450, text: "SECTION A-A" });
  return { id, kind: "section", title: "SECTION A-A", level: null, originX, originY: 0, primitives: prims };
}

function planSheet(spec: PlanSpec, family: Family, opts: FamilyOptions, originX: number) {
  const shaped: PlanSpec = { ...spec, omit: opts.shape === "l-shape" ? NOTCH[family] : undefined, doorMm: opts.doorMm, windowMm: opts.windowMm, windowHeadMm: opts.windowHeadMm };
  const built = buildPlan(shaped, { hooks: opts.hooks, walls: opts.walls });
  const sheet: Sheet = { id: spec.id, kind: "floor-plan", title: spec.title, level: spec.level, originX, originY: 0, primitives: built.primitives };
  return { sheet, built };
}

const BUNGALOW: PlanSpec = {
  id: "gf",
  title: "GROUND FLOOR PLAN",
  level: "+450",
  colWidths: [4500, 3300, 3600],
  rowDepths: [4200, 2400, 3900],
  names: [
    ["LOUNGE", "DINING", "KITCHEN"],
    ["STORE", "BATH", "WC"],
    ["BEDROOM", "BEDROOM", "MASTER BEDROOM"],
  ],
  externalMm: 225,
  internalMm: 150,
  solid: ["v:0:1", "h:0:1"],
  sanitary: [[1, 1], [1, 2]],
  columns: false,
  storeyHeightM: STOREY_M,
};

const DUPLEX_GF: PlanSpec = { ...BUNGALOW, id: "gf", names: [["LOUNGE", "DINING", "KITCHEN"], ["STUDY", "WC", "STORE"], ["GUEST BEDROOM", "LAUNDRY", "GARAGE"]], sanitary: [[1, 1]], columns: true };
const DUPLEX_FF: PlanSpec = { ...BUNGALOW, id: "ff", title: "FIRST FLOOR PLAN", level: "+3450", names: [["BEDROOM", "BEDROOM", "BEDROOM"], ["BATH", "BATH", "DRESSING"], ["FAMILY LOUNGE", "STAIR HALL", "MASTER BEDROOM"]], sanitary: [[1, 0], [1, 1]], columns: true };

// Mirrors the Ogudu block: 24 m square, 6 bays by 3, 28 columns, two flats a floor.
const BLOCK_FLOOR: Omit<PlanSpec, "id" | "title" | "level"> = {
  colWidths: [4000, 4000, 4000, 4000, 4000, 4000],
  rowDepths: [8000, 8000, 8000],
  names: [
    ["LOUNGE", "DINING", "KITCHEN", "KITCHEN", "DINING", "LOUNGE"],
    ["STORE", "STAIR HALL", "DRESSING", "DRESSING", "STAIR HALL", "STORE"],
    ["BEDROOM", "BEDROOM", "MASTER BEDROOM", "MASTER BEDROOM", "BEDROOM", "BEDROOM"],
  ],
  externalMm: 225,
  internalMm: 150,
  // the party wall between the flats and a few solid returns leave 22 doors
  solid: ["v:2:0", "v:2:1", "v:2:2", "h:0:0", "h:5:0"],
  sanitary: [[1, 2], [1, 3]],
  columns: true,
  storeyHeightM: STOREY_M,
};

const TOWER_FLOOR: Omit<PlanSpec, "id" | "title" | "level"> = {
  colWidths: [6000, 6000, 6000, 6000, 6000],
  rowDepths: [6000, 6000, 6000, 6000, 6000],
  names: Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => (r === 2 && c === 2 ? "LIFT LOBBY" : r === 2 && c === 1 ? "STAIR HALL" : `OFFICE ${r + 1}${c + 1}`))),
  externalMm: 300,
  internalMm: 150,
  solid: ["v:0:0", "v:3:4", "h:0:3", "h:4:0", "v:1:2"],
  sanitary: [[2, 3]],
  columns: true,
  storeyHeightM: STOREY_M,
};

export function buildFamily(family: Family, opts: FamilyOptions): FamilyBuild {
  resetIds();
  const sheets: Sheet[] = [];
  const rooms: TruthRoom[] = [];
  const elements: TruthElement[] = [];
  const truthSheets: TruthSheet[] = [];
  let x = 0;
  let planWidth = 0;
  let planDepth = 0;
  const addPlan = (spec: PlanSpec, repeats: number) => {
    const { sheet, built } = planSheet(spec, family, opts, x);
    sheets.push(sheet);
    rooms.push(...built.rooms);
    elements.push(...built.elements);
    truthSheets.push({ id: spec.id, kind: "floor-plan", title: spec.title, level: spec.level, repeats });
    planWidth = built.widthMm;
    planDepth = built.depthMm;
    x += built.widthMm + GUTTER_MM;
  };

  let storeys = 1;
  if (family === "bungalow") {
    addPlan(BUNGALOW, 1);
  } else if (family === "duplex") {
    storeys = 2;
    addPlan(DUPLEX_GF, 1);
    addPlan(DUPLEX_FF, 1);
  } else if (family === "block4") {
    storeys = 4;
    const levels = ["+450", "+3450", "+6450", "+9450"];
    const titles = ["GROUND FLOOR PLAN", "FIRST FLOOR PLAN", "SECOND FLOOR PLAN", "THIRD FLOOR PLAN"];
    for (let s = 0; s < 4; s++) addPlan({ ...BLOCK_FLOOR, id: `l${s}`, title: titles[s]!, level: levels[s]! }, 1);
  } else {
    storeys = 20;
    addPlan({ ...TOWER_FLOOR, id: "gf", title: "GROUND FLOOR PLAN", level: "+450", names: TOWER_FLOOR.names.map((row, r) => row.map((n, c) => (r === 0 && c === 2 ? "ENTRANCE LOBBY" : n))) }, 1);
    addPlan({ ...TOWER_FLOOR, id: "typ", title: "TYPICAL FLOOR PLAN (LEVELS 2-20)", level: "+3450" }, 19);
  }

  const windowsPerStorey = family === "tower20" ? 5 : 3;
  sheets.push(elevationSheet("elev", planWidth, storeys, windowsPerStorey, x, { w: opts.windowMm ?? 1200, h: opts.windowHeadMm ?? 1200 }));
  truthSheets.push({ id: "elev", kind: "elevation", title: "NORTH ELEVATION", level: null, repeats: 1 });
  x += planWidth + GUTTER_MM;
  sheets.push(sectionSheet("sec", planDepth, storeys, x));
  truthSheets.push({ id: "sec", kind: "section", title: "SECTION A-A", level: null, repeats: 1 });

  if (opts.schedule) {
    x += planDepth + GUTTER_MM;
    const repeats = new Map(truthSheets.map((s) => [s.id, s.repeats]));
    const count = (kind: TruthElement["element"]) => elements.filter((e) => e.element === kind).reduce((a, e) => a + (e.count ?? 0) * (repeats.get(e.sheet) ?? 1), 0);
    const sched = scheduleSheet([{ mark: "D01", widthMm: opts.doorMm ?? 900, heightMm: 2100, nr: count("doors") }], [{ mark: "W01", widthMm: opts.windowMm ?? 1200, heightMm: opts.windowHeadMm ?? 1200, nr: count("windows") }], x);
    sheets.push(sched.sheet);
    truthSheets.push(sched.truth);
  }

  const repeatOf = new Map(truthSheets.map((s) => [s.id, s.repeats]));
  const total = (kind: TruthElement["element"], field: "count" | "areaM2") =>
    Math.round(elements.filter((e) => e.element === kind).reduce((acc, e) => acc + (e[field] ?? 0) * (repeatOf.get(e.sheet) ?? 1), 0) * 100) / 100;

  const stated = rooms.length ? Math.round(rooms.filter((r) => r.sheet === sheets[0]!.id).reduce((a, r) => a + r.areaM2, 0)) : 0;
  if (family === "block4") {
    for (const sheet of sheets.filter((s) => s.kind === "floor-plan")) {
      sheet.primitives.push({ kind: "text", id: `${sheet.id}_stated`, layer: "text", x: 0, y: -4200, height: 250, text: `EACH FLAT OCCUPIES ${Math.round(stated / 2)} SQUARE METRES ONLY.` });
    }
  }

  return {
    sheets,
    planWidthMm: planWidth,
    truth: {
      family,
      storeys,
      storeyHeightM: STOREY_M,
      sheets: truthSheets,
      rooms,
      elements,
      building: {
        floorAreaM2: total("floor-area", "areaM2"),
        columns: total("columns", "count"),
        doors: total("doors", "count"),
        windows: total("windows", "count"),
        wallsExternalM2: total("walls-external", "areaM2"),
        wallsInternalM2: total("walls-internal", "areaM2"),
      },
    },
  };
}

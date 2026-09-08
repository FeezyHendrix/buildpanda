import { layerNameFor } from "./conventions.ts";
import type { Drawing, LayerRole, Primitive } from "./types.ts";

// Writes an AutoCAD 2000 (AC1015) DXF by hand: header units, a layer table,
// block definitions, and the entities section. LibreDWG's dwgwrite turns it
// into a DWG; dwgread reads that DWG back with act_measurement on dimensions,
// closed flags on polylines and entmode on every entity, which is what the
// engine consumes.

const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(4));

function pair(code: number, value: string | number): string {
  return `${String(code).padStart(3, " ")}\n${value}\n`;
}

function section(name: string, body: string): string {
  return pair(0, "SECTION") + pair(2, name) + body + pair(0, "ENDSEC");
}

// Every table record and entity carries a handle: without them dwgwrite
// cannot resolve an entity's layer by name and every entity lands on layer 0.
let handleSeed = 0x100;
const nextHandle = () => (handleSeed++).toString(16).toUpperCase();

function header(unitsCode: number): string {
  return section(
    "HEADER",
    pair(9, "$ACADVER") + pair(1, "AC1015") + pair(9, "$INSUNITS") + pair(70, unitsCode) + pair(9, "$MEASUREMENT") + pair(70, 1) + pair(9, "$HANDSEED") + pair(5, "FFFF"),
  );
}

function table(name: string, recordType: string, records: string[], recordBody: (i: number) => string): string {
  const tableHandle = nextHandle();
  const rows = records
    .map((n, i) => pair(0, name) + pair(5, nextHandle()) + pair(330, tableHandle) + pair(100, "AcDbSymbolTableRecord") + pair(100, recordType) + pair(2, n) + recordBody(i))
    .join("");
  return pair(0, "TABLE") + pair(2, name) + pair(5, tableHandle) + pair(100, "AcDbSymbolTable") + pair(70, records.length) + rows + pair(0, "ENDTAB");
}

// dwgwrite needs the linetype, layer and block-record tables to resolve the
// references it writes; without the block records it refuses the file.
function tables(layerNames: string[], blockNames: string[]): string {
  const ltype = table("LTYPE", "AcDbLinetypeTableRecord", ["CONTINUOUS"], () => pair(70, 0) + pair(3, "Solid line") + pair(72, 65) + pair(73, 0) + pair(40, 0));
  const layers = table("LAYER", "AcDbLayerTableRecord", layerNames, (i) => pair(70, 0) + pair(62, (i % 7) + 1) + pair(6, "CONTINUOUS"));
  const blocks = table("BLOCK_RECORD", "AcDbBlockTableRecord", ["*Model_Space", "*Paper_Space", ...blockNames], () => "");
  return section("TABLES", ltype + layers + blocks);
}

const ent = (type: string, layer: string) => pair(0, type) + pair(5, nextHandle()) + pair(100, "AcDbEntity") + pair(8, layer);

interface Ctx {
  layer: (role: LayerRole) => string;
  scale: number; // drawing units per mm
  ox: number;
  oy: number;
}

function entity(p: Primitive, ctx: Ctx): string {
  const L = ctx.layer(p.layer);
  const X = (v: number) => f((v + ctx.ox) * ctx.scale);
  const Y = (v: number) => f((v + ctx.oy) * ctx.scale);
  const S = (v: number) => f(v * ctx.scale);
  switch (p.kind) {
    case "line":
      return ent("LINE", L) + pair(100, "AcDbLine") + (p.heavy ? pair(370, 50) : "") + pair(10, X(p.x1)) + pair(20, Y(p.y1)) + pair(30, 0) + pair(11, X(p.x2)) + pair(21, Y(p.y2)) + pair(31, 0);
    case "polyline": {
      const pts = p.points.map(([x, y]) => pair(10, X(x!)) + pair(20, Y(y!))).join("");
      return ent("LWPOLYLINE", L) + pair(100, "AcDbPolyline") + (p.heavy ? pair(370, 50) : "") + pair(90, p.points.length) + pair(70, p.closed ? 1 : 0) + pts;
    }
    case "arc":
      return ent("ARC", L) + pair(100, "AcDbCircle") + pair(10, X(p.cx)) + pair(20, Y(p.cy)) + pair(30, 0) + pair(40, S(p.r)) + pair(100, "AcDbArc") + pair(50, p.startDeg) + pair(51, p.endDeg);
    case "text":
      return ent("TEXT", L) + pair(100, "AcDbText") + pair(10, X(p.x)) + pair(20, Y(p.y)) + pair(30, 0) + pair(40, S(p.height)) + pair(1, p.text) + pair(100, "AcDbText");
    case "insert":
      return ent("INSERT", L) + pair(100, "AcDbBlockReference") + pair(2, p.block) + pair(10, X(p.x)) + pair(20, Y(p.y)) + pair(30, 0) + pair(41, ctx.scale) + pair(42, ctx.scale) + pair(43, ctx.scale) + pair(50, p.rotationDeg);
    case "dimension": {
      const horizontal = p.y1 === p.y2;
      const dx = horizontal ? p.x1 : p.x1 + p.offset;
      const dy = horizontal ? p.y1 + p.offset : p.y1;
      const mx = horizontal ? (p.x1 + p.x2) / 2 : p.x1 + p.offset + 250;
      const my = horizontal ? p.y1 + p.offset + 250 : (p.y1 + p.y2) / 2;
      return (
        ent("DIMENSION", L) +
        pair(100, "AcDbDimension") +
        pair(2, "*D") +
        pair(10, X(dx)) +
        pair(20, Y(dy)) +
        pair(30, 0) +
        pair(11, X(mx)) +
        pair(21, Y(my)) +
        pair(31, 0) +
        pair(70, 33) +
        pair(1, "") +
        pair(42, S(p.value)) +
        pair(100, "AcDbAlignedDimension") +
        pair(13, X(p.x1)) +
        pair(23, Y(p.y1)) +
        pair(33, 0) +
        pair(14, X(p.x2)) +
        pair(24, Y(p.y2)) +
        pair(34, 0)
      );
    }
    default:
      return "";
  }
}

export function writeDxf(drawing: Drawing): string {
  handleSeed = 0x100;
  const layer = (role: LayerRole) => layerNameFor(drawing.convention, role);
  const roles = new Set<LayerRole>(["zero"]);
  for (const s of drawing.sheets) for (const p of s.primitives) roles.add(p.layer);
  for (const b of drawing.blocks) for (const p of b.primitives) roles.add(p.layer);
  const names = [...new Set([...roles].map(layer))];
  const scale = drawing.unitsPerMm;

  const blocks = drawing.blocks
    .map((b) => {
      const body = b.primitives.map((p) => entity(p, { layer, scale, ox: 0, oy: 0 })).join("");
      return (
        pair(0, "BLOCK") + pair(5, nextHandle()) + pair(100, "AcDbEntity") + pair(8, "0") + pair(100, "AcDbBlockBegin") + pair(2, b.name) + pair(70, 0) + pair(10, 0) + pair(20, 0) + pair(30, 0) + pair(3, b.name) +
        body +
        pair(0, "ENDBLK") + pair(5, nextHandle()) + pair(100, "AcDbEntity") + pair(8, "0") + pair(100, "AcDbBlockEnd")
      );
    })
    .join("");

  const entities = drawing.sheets
    .map((s) => s.primitives.map((p) => entity(p, { layer, scale, ox: s.originX, oy: s.originY })).join(""))
    .join("");

  return header(drawing.unitsPerMm === 1 ? 4 : 6) + tables(names, drawing.blocks.map((b) => b.name)) + section("BLOCKS", blocks) + section("ENTITIES", entities) + pair(0, "EOF");
}

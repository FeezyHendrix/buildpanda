import * as fs from "node:fs";
import * as path from "node:path";
import { layerNameFor } from "./conventions.ts";
import type { Drawing, LayerRole, Primitive } from "./types.ts";

// Writes LibreDWG's own JSON (the format `dwgread -O JSON` emits) so that
// `dwgwrite -I JSON` produces a DWG with layer, block and dimension
// references intact. LibreDWG 0.13's DXF import drops those references, so the
// DXF we also write is for humans and other tools, not for the engine.
//
// The skeleton is the JSON of an empty AC1015 file: file header, header
// variables, model-space block header, layer control with layer 0. Everything
// else is appended with fresh handles.

type Ref = [number, number, number, number];
const ref = (code: number, h: number): Ref => [code, h < 256 ? 1 : h < 65536 ? 2 : 3, h, h];
const HARD_OWNER = 3;
const SOFT_OWNER = 4;
const SOFT_POINTER = 5;
const NO_REF: Ref = [5, 0, 0, 0];

const SKELETON_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "skeleton.json");

interface Skeleton {
  HEADER: Record<string, unknown>;
  OBJECTS: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

function loadSkeleton(): Skeleton {
  return JSON.parse(fs.readFileSync(SKELETON_PATH, "utf8")) as Skeleton;
}

const COMMON_ENTITY = {
  preview_exists: 0,
  nolinks: 1,
  color: 256,
  ltype_scale: 1.0,
  ltype_flags: 0,
  plotstyle_flags: 0,
  invisible: 0,
  linewt: 29,
};

export function writeLibredwgJson(drawing: Drawing): string {
  const doc = loadSkeleton();
  const objects = doc.OBJECTS;
  const usedHandles = objects.map((o) => (o["handle"] as number[])[2]!);
  let seed = Math.max(...usedHandles) + 1;
  const next = () => seed++;
  const layerControl = objects.find((o) => o["object"] === "LAYER_CONTROL")!;
  const layerZero = objects.find((o) => o["object"] === "LAYER" && o["name"] === "0")!;
  const modelSpace = objects.find((o) => o["object"] === "BLOCK_HEADER")!;
  const scale = drawing.unitsPerMm;

  // layers
  const layerHandles = new Map<string, number>([["0", (layerZero["handle"] as number[])[2]!]]);
  const layerFor = (role: LayerRole): Ref => {
    const name = layerNameFor(drawing.convention, role);
    let h = layerHandles.get(name);
    if (h === undefined) {
      h = next();
      layerHandles.set(name, h);
      objects.push({
        ...layerZero,
        index: objects.length,
        handle: [0, 1, h],
        name,
        color: (layerHandles.size % 7) + 1,
      });
    }
    return ref(SOFT_POINTER, h);
  };

  const push = (o: Record<string, unknown>): number => {
    const h = next();
    objects.push({ ...o, index: objects.length, handle: [0, 1, h] });
    return h;
  };

  const entityFor = (p: Primitive, ox: number, oy: number, owner: { entmode: number; ownerHandle: number | null }): Record<string, unknown> => {
    const X = (v: number) => (v + ox) * scale;
    const Y = (v: number) => (v + oy) * scale;
    const base: Record<string, unknown> = {
      ...COMMON_ENTITY,
      layer: layerFor(p.layer),
      entmode: owner.entmode,
      ...(owner.ownerHandle === null ? {} : { ownerhandle: ref(SOFT_OWNER, owner.ownerHandle), nolinks: 0, prev_entity: [4, 0, 0, 0], next_entity: [4, 0, 0, 0] }),
    };
    switch (p.kind) {
      case "line":
        return { entity: "LINE", type: 19, _subclass: "AcDbLine", ...base, linewt: p.heavy ? 50 : 29, z_is_zero: 1, start: [X(p.x1), Y(p.y1), 0], end: [X(p.x2), Y(p.y2), 0], thickness: 0, extrusion: [0, 0, 1] };
      case "polyline":
        return { entity: "LWPOLYLINE", type: 77, _subclass: "AcDbPolyline", ...base, linewt: p.heavy ? 50 : 29, flag: p.closed ? 512 : 0, points: p.points.map(([x, y]) => [X(x!), Y(y!)]), bulges: [] };
      case "arc":
        return { entity: "ARC", type: 17, _subclass: "AcDbArc", ...base, center: [X(p.cx), Y(p.cy), 0], radius: p.r * scale, thickness: 0, extrusion: [0, 0, 1], start_angle: (p.startDeg * Math.PI) / 180, end_angle: (p.endDeg * Math.PI) / 180 };
      case "text":
        return { entity: "TEXT", type: 1, _subclass: "AcDbText", ...base, dataflags: 3, ins_pt: [X(p.x), Y(p.y)], extrusion: [0, 0, 1], thickness: 0, oblique_angle: 0, rotation: 0, height: p.height * scale, width_factor: 1, text_value: p.text, generation: 0, horiz_alignment: 0, vert_alignment: 0, style: NO_REF };
      case "insert":
        return { entity: "INSERT", type: 7, _subclass: "AcDbBlockReference", ...base, ins_pt: [X(p.x), Y(p.y), 0], scale_flag: 3, scale: [scale, scale, scale], rotation: (p.rotationDeg * Math.PI) / 180, extrusion: [0, 0, 1], has_attribs: 0, block_header: NO_REF, __block: p.block };
      case "dimension": {
        const horizontal = p.y1 === p.y2;
        const defX = horizontal ? p.x2 : p.x2 + p.offset;
        const defY = horizontal ? p.y2 + p.offset : p.y2;
        const midX = horizontal ? (p.x1 + p.x2) / 2 : p.x1 + p.offset + 250;
        const midY = horizontal ? p.y1 + p.offset + 250 : (p.y1 + p.y2) / 2;
        return {
          entity: "DIMENSION_ALIGNED",
          type: 22,
          _subclass: "AcDbAlignedDimension",
          ...base,
          extrusion: [0, 0, 1],
          text_midpt: [X(midX), Y(midY)],
          elevation: 0,
          flag1: 10,
          user_text: "",
          text_rotation: 0,
          horiz_dir: 0,
          ins_scale: [1, 1, 1],
          ins_rotation: 0,
          attachment: 5,
          lspace_style: 1,
          lspace_factor: 1,
          act_measurement: p.value * scale,
          clone_ins_pt: [0, 0],
          flag: 161,
          xline1_pt: [X(p.x1), Y(p.y1), 0],
          xline2_pt: [X(p.x2), Y(p.y2), 0],
          def_pt: [X(defX), Y(defY), 0],
          oblique_angle: 0,
          dimstyle: NO_REF,
          block: NO_REF,
        };
      }
      default:
        return { entity: "POINT", type: 27, _subclass: "AcDbPoint", ...base, point: [0, 0, 0] };
    }
  };

  // block definitions: header + BLOCK + entities + ENDBLK, linked as a list
  const blockHandles = new Map<string, number>();
  for (const b of drawing.blocks) {
    const headerHandle = next();
    blockHandles.set(b.name, headerHandle);
    const blockEntity = push({ entity: "BLOCK", type: 4, _subclass: "AcDbBlockBegin", ...COMMON_ENTITY, nolinks: 0, ownerhandle: ref(SOFT_OWNER, headerHandle), prev_entity: [4, 0, 0, 0], next_entity: [4, 0, 0, 0], layer: ref(SOFT_POINTER, layerHandles.get("0")!), entmode: 0, name: b.name });
    const members: number[] = [];
    for (const p of b.primitives) members.push(push(entityFor(p, 0, 0, { entmode: 0, ownerHandle: headerHandle })));
    const endblk = push({ entity: "ENDBLK", type: 5, _subclass: "AcDbBlockEnd", ...COMMON_ENTITY, nolinks: 0, ownerhandle: ref(SOFT_OWNER, headerHandle), prev_entity: [4, 0, 0, 0], next_entity: [4, 0, 0, 0], layer: ref(SOFT_POINTER, layerHandles.get("0")!), entmode: 0 });
    objects.push({
      ...modelSpace,
      index: objects.length,
      handle: [0, 1, headerHandle],
      name: b.name,
      block_entity: ref(HARD_OWNER, blockEntity),
      first_entity: members.length ? ref(SOFT_OWNER, members[0]!) : [4, 0, 0, 0],
      last_entity: members.length ? ref(SOFT_OWNER, members[members.length - 1]!) : [4, 0, 0, 0],
      endblk_entity: ref(HARD_OWNER, endblk),
    });
  }

  // model-space entities
  for (const sheet of drawing.sheets) {
    for (const p of sheet.primitives) {
      const e = entityFor(p, sheet.originX, sheet.originY, { entmode: 2, ownerHandle: null });
      if (e["__block"]) {
        const h = blockHandles.get(String(e["__block"]));
        e["block_header"] = h === undefined ? NO_REF : ref(SOFT_POINTER, h);
        delete e["__block"];
      }
      push(e);
    }
  }

  layerControl["entries"] = [...layerHandles.values()].map((h) => [2, 1, h, h]);
  doc.HEADER["INSUNITS"] = drawing.unitsPerMm === 1 ? 4 : 6;
  doc.HEADER["HANDSEED"] = [0, 2, seed + 1, seed + 1];
  const blockControl = objects.find((o) => o["object"] === "BLOCK_CONTROL");
  if (blockControl) blockControl["entries"] = [...blockHandles.values()].map((h) => [2, 1, h, h]);
  return JSON.stringify(doc);
}

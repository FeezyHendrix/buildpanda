import * as fs from "node:fs";
import * as path from "node:path";
import { layerNameFor } from "./conventions.ts";
import { COMMON_ENTITY, HARD_OWNER, NO_REF, SOFT_OWNER, SOFT_POINTER, buildAttrib, buildEntity, buildSeqend, ref, type Ref } from "./libredwg-entities.ts";
import type { Drawing, LayerRole, Primitive } from "./types.ts";

// Writes LibreDWG's own JSON (the format `dwgread -O JSON` emits) so that
// `dwgwrite -I JSON` produces a DWG with layer, block, attribute and
// dimension references intact. LibreDWG 0.13's DXF import drops those
// references, so the DXF we also write is for humans and other tools, not for
// the engine.
//
// The skeleton is the JSON of an empty AC1015 file: file header, header
// variables, model-space block header, layer control with layer 0. Everything
// else is appended with fresh handles.

const SKELETON_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "skeleton.json");

interface Skeleton {
  HEADER: Record<string, unknown>;
  OBJECTS: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

function loadSkeleton(): Skeleton {
  return JSON.parse(fs.readFileSync(SKELETON_PATH, "utf8")) as Skeleton;
}

const INSUNITS: Record<number, number> = { 1: 4, 0.001: 6 };

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
      objects.push({ ...layerZero, index: objects.length, handle: [0, 1, h], name, color: (layerHandles.size % 7) + 1 });
    }
    return ref(SOFT_POINTER, h);
  };
  const layerRef = (role: LayerRole): Ref => layerFor(role);

  const push = (o: Record<string, unknown>, handle = next()): number => {
    objects.push({ ...o, index: objects.length, handle: [0, handle < 256 ? 1 : 2, handle] });
    return handle;
  };

  const blockHandles = new Map<string, number>();

  // an entity plus, for an INSERT, its block reference and attributes
  const place = (p: Primitive, ox: number, oy: number, entmode: number, ownerHandle: number | null): number => {
    const built = buildEntity(p, { layer: layerRef(p.layer), ox, oy, scale, entmode, ownerHandle });
    const handle = next();
    if (built.block !== undefined) {
      const h = blockHandles.get(built.block);
      built.entity["block_header"] = h === undefined ? NO_REF : ref(SOFT_POINTER, h);
    }
    if (built.attributes && p.kind === "insert") {
      const first = seed;
      const tags = Object.entries(built.attributes);
      const last = first + tags.length - 1;
      built.entity["first_attrib"] = ref(SOFT_OWNER, first);
      built.entity["last_attrib"] = ref(SOFT_OWNER, last);
      built.entity["seqend"] = ref(HARD_OWNER, last + 1);
      push(built.entity, handle);
      tags.forEach(([tag, value], i) => push(buildAttrib(tag, value, (p.x + ox + 150) * scale, (p.y + oy + 150 + i * 300) * scale, 200 * scale, layerRef("text"), handle)));
      push(buildSeqend(layerRef("text"), handle));
      return handle;
    }
    push(built.entity, handle);
    return handle;
  };

  // block definitions: header + BLOCK + entities + ENDBLK, linked as a list.
  // Blocks that reference other blocks come after the blocks they use.
  for (const b of drawing.blocks) {
    const headerHandle = next();
    blockHandles.set(b.name, headerHandle);
    const blockEntity = push({ entity: "BLOCK", type: 4, _subclass: "AcDbBlockBegin", ...COMMON_ENTITY, nolinks: 0, ownerhandle: ref(SOFT_OWNER, headerHandle), prev_entity: [4, 0, 0, 0], next_entity: [4, 0, 0, 0], layer: ref(SOFT_POINTER, layerHandles.get("0")!), entmode: 0, name: b.name });
    const members: number[] = [];
    for (const p of b.primitives) members.push(place(p, 0, 0, 0, headerHandle));
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
  for (const sheet of drawing.sheets) for (const p of sheet.primitives) place(p, sheet.originX, sheet.originY, 2, null);

  layerControl["entries"] = [...layerHandles.values()].map((h) => [2, 1, h, h]);
  doc.HEADER["INSUNITS"] = INSUNITS[drawing.unitsPerMm] ?? (drawing.convention.units === "in" ? 1 : 4);
  doc.HEADER["HANDSEED"] = [0, 2, seed + 1, seed + 1];
  const blockControl = objects.find((o) => o["object"] === "BLOCK_CONTROL");
  if (blockControl) blockControl["entries"] = [...blockHandles.values()].map((h) => [2, 1, h, h]);
  return JSON.stringify(doc);
}

import type { Primitive } from "./types.ts";

// One LibreDWG JSON object per primitive, in the shape `dwgread -O JSON`
// emits (and `dwgwrite -I JSON` accepts): every entity carries its DWG type
// code, and references are [code, size, value, absolute] handle arrays.

export type Ref = [number, number, number, number];
export const ref = (code: number, h: number): Ref => [code, h < 256 ? 1 : h < 65536 ? 2 : 3, h, h];
export const HARD_OWNER = 3;
export const SOFT_OWNER = 4;
export const SOFT_POINTER = 5;
export const NO_REF: Ref = [5, 0, 0, 0];

export const COMMON_ENTITY = {
  preview_exists: 0,
  nolinks: 1,
  color: 256,
  ltype_scale: 1.0,
  ltype_flags: 0,
  plotstyle_flags: 0,
  invisible: 0,
  linewt: 29,
};

export interface EntityContext {
  layer: Ref;
  ox: number;
  oy: number;
  scale: number; // drawing units per mm
  entmode: number;
  ownerHandle: number | null;
}

export interface BuiltEntity {
  entity: Record<string, unknown>;
  // block the entity references (an INSERT), resolved to a handle by the caller
  block?: string;
  // ATTRIB values the caller must append after the INSERT
  attributes?: Record<string, string>;
}

const TEXT_BASE = { extrusion: [0, 0, 1], thickness: 0, oblique_angle: 0, rotation: 0, width_factor: 1, generation: 0, horiz_alignment: 0, vert_alignment: 0, style: NO_REF };

export function buildEntity(p: Primitive, ctx: EntityContext): BuiltEntity {
  const X = (v: number) => (v + ctx.ox) * ctx.scale;
  const Y = (v: number) => (v + ctx.oy) * ctx.scale;
  const base: Record<string, unknown> = {
    ...COMMON_ENTITY,
    layer: ctx.layer,
    entmode: ctx.entmode,
    ...(ctx.ownerHandle === null ? {} : { ownerhandle: ref(SOFT_OWNER, ctx.ownerHandle), nolinks: 0, prev_entity: [4, 0, 0, 0], next_entity: [4, 0, 0, 0] }),
  };
  switch (p.kind) {
    case "line":
      return { entity: { entity: "LINE", type: 19, _subclass: "AcDbLine", ...base, linewt: p.heavy ? 50 : 29, z_is_zero: 1, start: [X(p.x1), Y(p.y1), 0], end: [X(p.x2), Y(p.y2), 0], thickness: 0, extrusion: [0, 0, 1] } };
    case "polyline":
      return { entity: { entity: "LWPOLYLINE", type: 77, _subclass: "AcDbPolyline", ...base, linewt: p.heavy ? 50 : 29, flag: p.closed ? 512 : 0, points: p.points.map(([x, y]) => [X(x!), Y(y!)]), bulges: [] } };
    case "arc":
      return { entity: { entity: "ARC", type: 17, _subclass: "AcDbArc", ...base, center: [X(p.cx), Y(p.cy), 0], radius: p.r * ctx.scale, thickness: 0, extrusion: [0, 0, 1], start_angle: (p.startDeg * Math.PI) / 180, end_angle: (p.endDeg * Math.PI) / 180 } };
    case "text":
      return { entity: { entity: "TEXT", type: 1, _subclass: "AcDbText", ...base, dataflags: 3, ins_pt: [X(p.x), Y(p.y)], ...TEXT_BASE, height: p.height * ctx.scale, text_value: p.text } };
    case "hatch":
      return {
        entity: {
          entity: "HATCH",
          type: 78,
          _subclass: "AcDbHatch",
          ...base,
          elevation: 0,
          extrusion: [0, 0, 1],
          name: "SOLID",
          is_solid_fill: 1,
          is_associative: 0,
          num_paths: 1,
          paths: [{ flag: 7, bulges_present: 0, closed: 1, num_segs_or_paths: p.points.length, polyline_paths: p.points.map(([x, y]) => ({ point: [X(x!), Y(y!)] })), num_boundary_handles: 0, boundary_handles: [] }],
          style: 1,
          pattern_type: 1,
          angle: 0,
          scale_spacing: 1,
          double_flag: 0,
          num_deflines: 0,
          deflines: [],
          pixel_size: 0,
          num_seeds: 0,
          seeds: [],
          num_boundary_handles: 0,
        },
      };
    case "insert":
      return {
        entity: { entity: "INSERT", type: 7, _subclass: "AcDbBlockReference", ...base, ins_pt: [X(p.x), Y(p.y), 0], scale_flag: 3, scale: [(p.scaleX ?? 1) * ctx.scale, ctx.scale, ctx.scale], rotation: (p.rotationDeg * Math.PI) / 180, extrusion: [0, 0, 1], has_attribs: p.attributes ? 1 : 0, block_header: NO_REF },
        block: p.block,
        attributes: p.attributes,
      };
    case "dimension": {
      const horizontal = p.y1 === p.y2;
      const defX = horizontal ? p.x2 : p.x2 + p.offset;
      const defY = horizontal ? p.y2 + p.offset : p.y2;
      const midX = horizontal ? (p.x1 + p.x2) / 2 : p.x1 + p.offset + 250;
      const midY = horizontal ? p.y1 + p.offset + 250 : (p.y1 + p.y2) / 2;
      return {
        entity: {
          entity: "DIMENSION_ALIGNED",
          type: 22,
          _subclass: "AcDbAlignedDimension",
          ...base,
          extrusion: [0, 0, 1],
          text_midpt: [X(midX), Y(midY)],
          elevation: 0,
          flag1: 10,
          user_text: p.text ?? "",
          text_rotation: 0,
          horiz_dir: 0,
          ins_scale: [1, 1, 1],
          ins_rotation: 0,
          attachment: 5,
          lspace_style: 1,
          lspace_factor: 1,
          act_measurement: p.value * ctx.scale,
          clone_ins_pt: [0, 0],
          flag: 161,
          xline1_pt: [X(p.x1), Y(p.y1), 0],
          xline2_pt: [X(p.x2), Y(p.y2), 0],
          def_pt: [X(defX), Y(defY), 0],
          oblique_angle: 0,
          dimstyle: NO_REF,
          block: NO_REF,
        },
      };
    }
    default:
      return { entity: { entity: "POINT", type: 27, _subclass: "AcDbPoint", ...base, point: [0, 0, 0] } };
  }
}

// An ATTRIB owned by an INSERT: the value drawn as text beside the insertion point.
export function buildAttrib(tag: string, value: string, x: number, y: number, height: number, layer: Ref, insertHandle: number): Record<string, unknown> {
  return {
    entity: "ATTRIB",
    type: 2,
    _subclass: "AcDbAttribute",
    ...COMMON_ENTITY,
    layer,
    entmode: 0,
    nolinks: 0,
    ownerhandle: ref(8, insertHandle),
    prev_entity: [4, 0, 0, 0],
    next_entity: [4, 0, 0, 0],
    dataflags: 3,
    ins_pt: [x, y],
    ...TEXT_BASE,
    height,
    text_value: value,
    tag,
    field_length: 0,
    flags: 0,
  };
}

export function buildSeqend(layer: Ref, insertHandle: number): Record<string, unknown> {
  return { entity: "SEQEND", type: 6, _subclass: "AcDbEntity", ...COMMON_ENTITY, layer, entmode: 0, nolinks: 0, ownerhandle: [12, 2, insertHandle, insertHandle], prev_entity: [4, 0, 0, 0], next_entity: [4, 0, 0, 0] };
}

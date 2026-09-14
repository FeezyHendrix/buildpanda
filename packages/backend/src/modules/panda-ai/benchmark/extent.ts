import type { Primitive } from "./types.ts";

export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Axis-aligned extent of a set of primitives in millimetres. Inserts count
// their insertion point only; block geometry is small beside a plan.
export function extentOf(primitives: Primitive[]): Extent {
  const ext: Extent = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const grow = (x: number, y: number) => {
    ext.minX = Math.min(ext.minX, x);
    ext.maxX = Math.max(ext.maxX, x);
    ext.minY = Math.min(ext.minY, y);
    ext.maxY = Math.max(ext.maxY, y);
  };
  for (const p of primitives) {
    if (p.kind === "line") {
      grow(p.x1, p.y1);
      grow(p.x2, p.y2);
    } else if (p.kind === "polyline" || p.kind === "hatch") for (const [x, y] of p.points) grow(x!, y!);
    else if (p.kind === "arc") {
      grow(p.cx - p.r, p.cy - p.r);
      grow(p.cx + p.r, p.cy + p.r);
    } else if (p.kind === "text" || p.kind === "insert") grow(p.x, p.y);
    else if (p.kind === "dimension") {
      grow(p.x1, p.y1);
      grow(p.x2, p.y2);
      grow(p.x1 + (p.x1 === p.x2 ? p.offset : 0), p.y1 + (p.y1 === p.y2 ? p.offset : 0));
    }
  }
  return ext;
}

// Centre of a primitive along x, for deciding which side of a mirror line it sits on.
export function xRange(p: Primitive): [number, number] {
  const e = extentOf([p]);
  return [e.minX, e.maxX];
}

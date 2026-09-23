// The cycle gate.
//
// The feasibility spike established the reason this exists: with every tested
// iteration setting, Univer returned plausible NUMBERS for circular formulas,
// and those numbers moved on each recalculation. No setting produced the
// expected cycle error. So a cyclic workbook does not fail loudly on its own —
// it quietly produces a different bill every time it is opened.
//
// What it walks is the engine's OWN adjacency list, from the public
// `getAllDependencyTrees()`. Nothing here parses a formula or computes a value;
// it is graph colouring over data the engine handed us, run before a single
// result is read for persistence.
//
// The walk is iterative. A recursive DFS over a deep dependency chain — a
// column where each row references the one above it, which is an ordinary
// takeoff shape — overflows the stack, and a crashed worker is indistinguishable
// from an engine fault. An explicit stack turns the same document into a bound
// that is either satisfied or reported.

import { rejectWorkbook } from "./engine-errors.ts";

/**
 * The shape the gate needs from a dependency tree. Structural on purpose:
 * Univer's `IFormulaDependencyTreeJson` satisfies it, and so does a fixture,
 * so the gate is testable without booting an engine.
 */
export interface DependencyNode {
  readonly treeId: number;
  readonly children: readonly number[];
  readonly subUnitId: string;
  readonly row: number;
  readonly column: number;
}

export interface CycleGraphLimits {
  readonly maxGraphNodes: number;
  readonly maxGraphEdges: number;
  readonly maxReportedCycles: number;
}

const WHITE = 0;
const GREY = 1;
const BLACK = 2;

/** Rotate to start at the smallest id so the same loop is never reported twice. */
function canonical(path: readonly number[]): string {
  let start = 0;
  for (let i = 1; i < path.length; i++) {
    if ((path[i] ?? 0) < (path[start] ?? 0)) start = i;
  }
  return [...path.slice(start), ...path.slice(0, start)].join(",");
}

/**
 * Every cycle in the engine's dependency graph, as readable cell paths.
 * An empty result means the candidate is acyclic and its values may be published.
 */
export function findFormulaCycles(nodes: readonly DependencyNode[], limits: CycleGraphLimits): readonly string[] {
  if (nodes.length > limits.maxGraphNodes) {
    rejectWorkbook(
      "too_large",
      `workbook produced ${nodes.length} dependency nodes (max ${limits.maxGraphNodes}), which is more than the ` +
        "cycle gate will walk. Results are not published for a graph that cannot be checked.",
    );
  }

  const byId = new Map<number, DependencyNode>();
  for (const node of nodes) byId.set(node.treeId, node);

  const label = (id: number): string => {
    const node = byId.get(id);
    return node === undefined ? `#${id}` : `${node.subUnitId}!r${node.row}c${node.column}`;
  };

  const colour = new Map<number, number>();
  const found = new Map<string, string>();
  let edges = 0;

  for (const root of nodes) {
    if ((colour.get(root.treeId) ?? WHITE) !== WHITE) continue;

    // `path` mirrors the frames on `stack`, so the loop that closed a cycle can
    // be sliced straight out of it without a second traversal.
    const stack: { id: number; next: number }[] = [{ id: root.treeId, next: 0 }];
    const path: number[] = [root.treeId];
    colour.set(root.treeId, GREY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame === undefined) break;
      const children = byId.get(frame.id)?.children ?? [];

      if (frame.next >= children.length) {
        colour.set(frame.id, BLACK);
        stack.pop();
        path.pop();
        continue;
      }

      const child = children[frame.next];
      frame.next += 1;
      if (child === undefined) continue;

      edges += 1;
      if (edges > limits.maxGraphEdges) {
        rejectWorkbook(
          "too_large",
          `workbook's dependency graph exceeds ${limits.maxGraphEdges} edges, which is more than the cycle gate ` +
            "will walk. Results are not published for a graph that cannot be checked.",
        );
      }

      const childColour = colour.get(child) ?? WHITE;
      if (childColour === GREY) {
        const from = path.indexOf(child);
        if (from >= 0) {
          const loop = [...path.slice(from), child];
          found.set(canonical(loop.slice(0, -1)), loop.map(label).join(" -> "));
        }
        continue;
      }
      if (childColour === BLACK) continue;

      colour.set(child, GREY);
      stack.push({ id: child, next: 0 });
      path.push(child);
    }
  }

  return Object.freeze([...found.values()]);
}

/** Refuse the calculation when the engine's own graph loops back on itself. */
export function assertAcyclic(nodes: readonly DependencyNode[], limits: CycleGraphLimits): void {
  const cycles = findFormulaCycles(nodes, limits);
  if (cycles.length === 0) return;
  const shown = cycles.slice(0, limits.maxReportedCycles);
  const extra = cycles.length - shown.length;
  rejectWorkbook(
    "cyclic_formula",
    `workbook contains ${cycles.length} circular reference${cycles.length === 1 ? "" : "s"}; ` +
      `no calculated value is published. ${shown.join(" ; ")}${extra > 0 ? ` (+${extra} more)` : ""}`,
    { cycles: shown },
  );
}

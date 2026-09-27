/**
 * The Contracts & phases page opens drawers on top of each other: a contract,
 * then one of its phases. Only the top entry has focus; closing pops it.
 * Mirrors the reference product's `rightBarStatus` array.
 */

export type DrawerEntry =
  | { kind: "contract"; contractId: string }
  | { kind: "phase"; stageId: string };

export function pushEntry(stack: DrawerEntry[], entry: DrawerEntry): DrawerEntry[] {
  const top = stack[stack.length - 1];
  if (top && sameEntry(top, entry)) return stack;
  return [...stack, entry];
}

export function popEntry(stack: DrawerEntry[]): DrawerEntry[] {
  return stack.slice(0, -1);
}

function sameEntry(a: DrawerEntry, b: DrawerEntry): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "contract" ? a.contractId === (b as typeof a).contractId : a.stageId === (b as typeof a).stageId;
}

export function topContractId(stack: DrawerEntry[]): string | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const entry = stack[index]!;
    if (entry.kind === "contract") return entry.contractId;
  }
  return null;
}

export function topPhaseId(stack: DrawerEntry[]): string | null {
  const top = stack[stack.length - 1];
  return top?.kind === "phase" ? top.stageId : null;
}

// When a retry is the SAME save, and what "someone else got there first"
// actually changed.
//
// The server de-duplicates on `operationId`, so a retry that reuses one is
// answered from the first attempt's record instead of being applied twice.
// That makes reusing an id the correct move after a timeout — and the WRONG
// move after the user types something else, because the server would then
// return the receipt for work they have since changed and report a save that
// did not happen. So an id lives exactly as long as the candidate it was minted
// for, and the candidate is identified by its content rather than by a flag
// somebody has to remember to clear.

import type { WorkbookDocument, WorkbookRowPatch, WorkbookSnapshot } from "@/api/workbook-types";

export interface PendingSave {
  readonly operationId: string;
  /** Identifies the exact work this id was minted for. */
  readonly fingerprint: string;
  readonly attempts: number;
}

/**
 * A stable, cheap identity for one save attempt's payload.
 *
 * FNV-1a over the serialized request. It is not a security hash and does not
 * need to be: it only has to change when the work changes, and a collision
 * would at worst reuse an id the server then refuses as a mismatched replay
 * with a 409 — loudly, and without applying anything.
 */
export function candidateFingerprint(request: {
  readonly expectedVersion: number;
  readonly expectedSourceFingerprint: string;
  readonly snapshot: WorkbookSnapshot;
  readonly rowPatches?: readonly WorkbookRowPatch[];
}): string {
  const text = JSON.stringify([
    request.expectedVersion,
    request.expectedSourceFingerprint,
    request.snapshot,
    request.rowPatches ?? [],
  ]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(36)}-${text.length.toString(36)}`;
}

/**
 * The operation id this attempt should carry.
 *
 * Same work as the attempt that failed -> the same id, so the server can tell
 * us our save already landed. Different work -> a fresh id, because claiming
 * otherwise would ask the server to answer a question about a document that no
 * longer exists.
 */
export function planSave(pending: PendingSave | null, fingerprint: string, mintId: () => string): PendingSave {
  if (pending !== null && pending.fingerprint === fingerprint) {
    return { ...pending, attempts: pending.attempts + 1 };
  }
  return { operationId: mintId(), fingerprint, attempts: 1 };
}

/** `crypto.randomUUID` where it exists, and a real fallback where it does not. */
export function mintOperationId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ------------------------------------------------------------- what conflicts

export interface ConflictLine {
  readonly label: string;
  readonly mine: string;
  readonly theirs: string;
}

export interface ConflictReport {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly actor: string | null;
  readonly at: string | null;
  /** True when the figures the workbook depends on moved, not just its cells. */
  readonly sourcesMoved: boolean;
  readonly lines: readonly ConflictLine[];
}

function cellText(snapshot: WorkbookSnapshot, sheetId: string, row: string, column: string): string {
  const cell = snapshot.sheets[sheetId]?.cellData[row]?.[column];
  if (cell === undefined) return "(empty)";
  if (cell.f !== undefined) return cell.f;
  if (cell.v === undefined || cell.v === null || cell.v === "") return "(empty)";
  return String(cell.v);
}

const MAX_LINES = 12;

/**
 * Which cells a person actually has to decide about.
 *
 * Only cells where MY document and THEIR document disagree are listed, and only
 * for worksheets both still have — a worksheet one side invented is not a
 * disagreement about a value, and listing every cell of it would bury the ones
 * that matter.
 */
export function compareForConflict(mine: WorkbookSnapshot, server: WorkbookDocument): ConflictReport {
  const lines: ConflictLine[] = [];
  const nameOf = new Map(server.layout.sheets.map((sheet) => [sheet.sheetId, sheet.label]));

  for (const sheetId of server.snapshot.sheetOrder) {
    if (lines.length >= MAX_LINES) break;
    const theirs = server.snapshot.sheets[sheetId];
    const ours = mine.sheets[sheetId];
    if (!theirs || !ours) continue;

    const rows = new Set([...Object.keys(theirs.cellData), ...Object.keys(ours.cellData)]);
    for (const row of [...rows].sort((a, b) => Number(a) - Number(b))) {
      if (lines.length >= MAX_LINES) break;
      const columns = new Set([
        ...Object.keys(theirs.cellData[row] ?? {}),
        ...Object.keys(ours.cellData[row] ?? {}),
      ]);
      for (const column of [...columns].sort((a, b) => Number(a) - Number(b))) {
        if (lines.length >= MAX_LINES) break;
        const a = cellText(mine, sheetId, row, column);
        const b = cellText(server.snapshot, sheetId, row, column);
        if (a === b) continue;
        lines.push({
          label: `${nameOf.get(sheetId) ?? sheetId} · row ${Number(row) + 1}, column ${Number(column) + 1}`,
          mine: a,
          theirs: b,
        });
      }
    }
  }

  return {
    fromVersion: 0,
    toVersion: server.version,
    actor: server.updatedBy,
    at: server.updatedAt,
    sourcesMoved: server.reviewRollup.sourcesMoved,
    lines,
  };
}

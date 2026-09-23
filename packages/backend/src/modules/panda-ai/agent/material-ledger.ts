/**
 * Shaping the material ledger for the assistant.
 *
 * A void in this product is a record, not a deletion. Voiding an entry leaves
 * the original in place with status 'Voided' and posts a VOID entry against it
 * carrying the reason and the person who did it, plus a reversing stock_delta.
 * Anything that reads the ledger and quietly drops those rows loses a
 * contractual fact — "the AI didn't pick up material that was voided and
 * logged" — so both rows are reported, the void is labelled a void, and the
 * quantity it undid is excluded from what counts toward stock.
 *
 * Split out of tools.ts (already far over the file-size ceiling) and kept pure
 * so the reconciliation can be asserted without a database.
 */

export interface LedgerEntryRowLite {
  id: string;
  entry_type: string;
  status: string;
  material_name: string;
  unit: string;
  location_key: string;
  quantity: string | number;
  stock_delta: string | number;
  occurred_at: string | Date;
  approval_status: string;
  reversal_for_entry_id: string | null;
  reason: string | null;
  supplier: string | null;
  delivery_note: string | null;
  negative_stock: boolean;
  timestamp_suspect: boolean;
  self_approved: boolean;
  logged_by_name: string | null;
  approved_by_name: string | null;
}

export interface ReversalRowLite {
  reversal_for_entry_id: string;
  reason: string | null;
  occurred_at: string | Date;
  logged_by_name: string | null;
}

export interface ShapedLedgerEntry {
  id: string;
  entryType: string;
  movement: string;
  material: string;
  unit: string;
  location: string;
  quantity: number;
  stockDelta: number;
  occurredAt: string;
  loggedBy: string | null;
  approvalStatus: string;
  approvedBy: string | null;
  supplier: string | null;
  deliveryNote: string | null;
  note: string | null;
  /** True for the original movement that has since been voided. */
  voided: boolean;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
  /** For a VOID row: the entry it reverses. */
  reverses: string | null;
  /** False for pending claims, voided movements and the voids themselves. */
  countsTowardStock: boolean;
  flags: string[];
}

export interface ShapedLedger {
  entries: ShapedLedgerEntry[];
  totals: {
    entryCount: number;
    voidedEntryCount: number;
    voidEntryCount: number;
    pendingApprovalCount: number;
    countedReceived: number;
    countedUsed: number;
    voidedQuantity: number;
  };
  /** Present only when there are entries, so an empty ledger stays empty. */
  note?: string;
}

function num(value: string | number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** "Received", "Used" or "Void" — the movement as the Material log labels it. */
function movementLabel(entryType: string): string {
  if (entryType === "IN") return "Received";
  if (entryType === "USED") return "Used";
  return "Void";
}

export function shapeLedger(
  rows: LedgerEntryRowLite[],
  reversals: ReversalRowLite[],
): ShapedLedger {
  const reversalFor = new Map<string, ReversalRowLite>();
  for (const reversal of reversals) reversalFor.set(reversal.reversal_for_entry_id, reversal);
  // A void inside the same page also explains its original, so the caller does
  // not have to have asked for the reversal separately.
  for (const row of rows) {
    if (row.entry_type === "VOID" && row.reversal_for_entry_id) {
      reversalFor.set(row.reversal_for_entry_id, {
        reversal_for_entry_id: row.reversal_for_entry_id,
        reason: row.reason,
        occurred_at: row.occurred_at,
        logged_by_name: row.logged_by_name,
      });
    }
  }

  let countedReceived = 0;
  let countedUsed = 0;
  let voidedQuantity = 0;
  let voidedEntryCount = 0;
  let voidEntryCount = 0;
  let pendingApprovalCount = 0;

  const entries = rows.map((row) => {
    const isVoid = row.entry_type === "VOID";
    const voided = row.status === "Voided";
    const pending = row.approval_status === "Pending";
    const quantity = num(row.quantity);
    // A pending entry never moved stock, and a voided one was undone by its
    // reversal. Only accepted, live movements are counted.
    const countsTowardStock = !isVoid && !voided && !pending;

    if (isVoid) voidEntryCount += 1;
    if (voided) {
      voidedEntryCount += 1;
      voidedQuantity += quantity;
    }
    if (pending && !voided) pendingApprovalCount += 1;
    if (countsTowardStock && row.entry_type === "IN") countedReceived += quantity;
    if (countsTowardStock && row.entry_type === "USED") countedUsed += quantity;

    const reversal = voided ? reversalFor.get(row.id) : undefined;
    const flags: string[] = [];
    if (row.negative_stock) flags.push("negative stock");
    if (row.timestamp_suspect) flags.push("timestamp flagged");
    if (row.self_approved) flags.push("self approved");

    return {
      id: row.id,
      entryType: row.entry_type,
      movement: movementLabel(row.entry_type),
      material: row.material_name,
      unit: row.unit,
      location: row.location_key,
      quantity,
      stockDelta: num(row.stock_delta),
      occurredAt: iso(row.occurred_at),
      loggedBy: row.logged_by_name,
      approvalStatus: row.approval_status,
      approvedBy: row.approved_by_name,
      supplier: row.supplier,
      deliveryNote: row.delivery_note,
      // On a VOID row `reason` IS the void reason; on a live movement it is a note.
      note: isVoid ? null : row.reason,
      voided,
      voidReason: isVoid ? row.reason : (reversal?.reason ?? null),
      voidedBy: isVoid ? row.logged_by_name : (reversal?.logged_by_name ?? null),
      voidedAt: isVoid
        ? iso(row.occurred_at)
        : reversal
          ? iso(reversal.occurred_at)
          : null,
      reverses: isVoid ? row.reversal_for_entry_id : null,
      countsTowardStock,
      flags,
    };
  });

  return {
    entries,
    totals: {
      entryCount: entries.length,
      voidedEntryCount,
      voidEntryCount,
      pendingApprovalCount,
      countedReceived: round2(countedReceived),
      countedUsed: round2(countedUsed),
      voidedQuantity: round2(voidedQuantity),
    },
    ...(entries.length > 0
      ? {
          note: "A void is a record, not a deletion: the original movement stays on the ledger with voided=true and a matching VOID entry carries the reason and who voided it. Entries with countsTowardStock=false (voided, the voids themselves, and movements still awaiting approval) do NOT count toward on-hand stock. The totals here cover only the entries returned in this page.",
        }
      : {}),
  };
}

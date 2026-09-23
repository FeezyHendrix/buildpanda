// Turning a client's requested changes into the row patch that expresses them.
//
// Pure on purpose: it takes the row as read and the changes as asked for, and
// returns what should be written. Both the pooled `PATCH /precon/rows/:rowId`
// and the transactional save-and-verify go through it, so one save cannot
// apply a different review policy from the other.
//
// It also decides whether the save is a no-op. The editor sends the whole line
// on every save, so "the client mentioned this field" says nothing about
// whether anything moved; only comparing the computed result against what is
// stored does. A save that changes nothing must not bump the version, because
// every other editor's optimistic check is keyed on that number.

import { BadRequestError } from "../../../lib/errors.ts";
import { num } from "./dto.ts";
import { basisFor } from "./measurement-basis.ts";
import { netQuantity, normaliseTypical } from "./measurements.ts";
import { isQuantityChanging, measuredStateOf, reviewPatchFor, sameQuantity, type MeasuredState } from "./review-policy.ts";
import type { PreconRowRepository } from "./row-repository.ts";
import type { PreconBoqRowRow, UpdateRowBody } from "./types.ts";

export type RowPatch = Parameters<PreconRowRepository["updateRowVersioned"]>[2];

export interface RowUpdatePlan {
  patch: RowPatch;
  /** Nothing this save would write differs from what is already stored. */
  noOp: boolean;
}

function isPriced(row: PreconBoqRowRow): boolean {
  return row.row_type === "item" || row.row_type === "provisional_sum";
}

/** The fields a save may move that are not part of the measured figure. */
function sameMetadata(row: PreconBoqRowRow, patch: RowPatch): boolean {
  if (patch.description !== undefined && patch.description !== row.description) return false;
  if (patch.rate !== undefined && !sameQuantity(num(patch.rate), num(row.rate))) return false;
  if (patch.amount !== undefined && !sameQuantity(num(patch.amount), num(row.amount))) return false;
  if (patch.measurement_basis !== undefined && patch.measurement_basis !== row.measurement_basis) return false;
  return true;
}

export function buildRowUpdatePatch(
  row: PreconBoqRowRow,
  changes: UpdateRowBody["changes"],
  actor: string,
): RowUpdatePlan {
  if (!isPriced(row) && changes.qty !== undefined) throw new BadRequestError("Only priced rows carry quantities");

  const patch: RowPatch = {};
  if (changes.description !== undefined) patch.description = changes.description;
  if (changes.unit !== undefined) patch.unit = changes.unit;
  // typical re-derives qty from the drawn figure; an explicit qty still wins
  if (changes.typical !== undefined) {
    if (!isPriced(row)) throw new BadRequestError("Only priced rows repeat on typical floors");
    const typical = normaliseTypical(changes.typical);
    const gross = num(row.qty_gross) ?? num(row.qty) ?? 0;
    const net = netQuantity(gross, row.deductions ?? [], typical);
    patch.typical = typical;
    patch.qty = net;
    patch.measurement_basis = basisFor({
      basis: row.measurement_basis,
      gross,
      deductions: row.deductions ?? [],
      typical,
      net,
      unit: changes.unit ?? row.unit,
    });
  }
  if (changes.qty !== undefined) patch.qty = changes.qty;
  if (changes.rate !== undefined) {
    patch.rate = changes.rate;
    patch.rate_source = changes.rate === null ? null : "manual";
  }
  const qty = patch.qty !== undefined ? num(patch.qty) : num(row.qty);
  // `!== undefined` rather than `??`: a cleared rate is null, and `??` would
  // read that as "not supplied" and fall back to the rate being cleared.
  const rate = changes.rate !== undefined ? changes.rate : num(row.rate);
  if (qty !== null && rate !== null) patch.amount = Math.round(qty * rate * 100) / 100;
  else if (changes.rate === null) patch.amount = null;

  const before = measuredStateOf(row);
  const after: MeasuredState = {
    ...before,
    qty,
    unit: patch.unit ?? row.unit,
    typical: patch.typical ?? row.typical ?? 1,
  };
  const noOp = sameMetadata(row, patch) && !isQuantityChanging(before, after);
  Object.assign(patch, reviewPatchFor(row, before, after));
  patch.edited_at = new Date();
  patch.edited_by = actor;
  return { patch, noOp };
}

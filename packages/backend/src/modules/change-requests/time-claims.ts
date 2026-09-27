import { BadRequestError } from "../../lib/errors.ts";
import type { ChangeDelayRow, ChangeRequestRow } from "./types.ts";

/**
 * The rules that only apply to a change request claiming time (`eot_only`).
 *
 * A time claim is argued from delay events, and only from delays the contractor
 * is not culpable for. Putting a late delivery of your own into a claim is the
 * single thing that turns a register into a liability, so it is refused with the
 * offending delays named — on submit, on resubmit and again at the decision,
 * because a delay can be re-attributed between the claim and the award.
 */

export interface DelaySource {
  delaysByIds(projectId: string, ids: string[]): Promise<ChangeDelayRow[]>;
  delaysForChanges(changeRequestIds: string[]): Promise<ChangeDelayRow[]>;
}

export function claimsTime(row: Pick<ChangeRequestRow, "type">): boolean {
  return row.type === "eot_only";
}

/** Refuses a claim citing a delay that is not on this project or not claimable. */
export async function assertClaimable(
  source: DelaySource,
  projectId: string,
  delayIds: string[],
): Promise<void> {
  if (delayIds.length === 0) return;
  const rows = await source.delaysByIds(projectId, delayIds);
  const found = new Set(rows.map((r) => r.id));
  const missing = delayIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new BadRequestError(`Delay not found on this project: ${missing.join(", ")}`);
  }
  assertNoneCulpable(rows);
}

/** The same check against the delays already attached to a claim. */
export async function assertAttachedClaimable(
  source: DelaySource,
  row: ChangeRequestRow,
): Promise<void> {
  if (!claimsTime(row)) return;
  assertNoneCulpable(await source.delaysForChanges([row.id]));
}

function assertNoneCulpable(rows: ChangeDelayRow[]): void {
  const culpable = rows.filter((r) => !r.eot_claimable);
  if (culpable.length === 0) return;
  throw new BadRequestError(
    `These delays are not claimable as an extension of time: ${culpable
      .map((r) => `${r.activity_name} (${r.reason_code}, ${r.culpability})`)
      .join("; ")}`,
    { delayIds: culpable.map((r) => r.id) },
  );
}

/**
 * The days a decision grants. An approval that names no figure awards what was
 * claimed; naming one awards that instead, which is the usual case — an
 * engineer rarely grants the full claim.
 */
export function daysToAward(row: ChangeRequestRow, daysAwarded: number | undefined): number {
  const claimed = Number(row.time_impact_days ?? 0);
  if (daysAwarded === undefined) return Math.max(0, Math.trunc(claimed));
  return Math.max(0, Math.trunc(daysAwarded));
}

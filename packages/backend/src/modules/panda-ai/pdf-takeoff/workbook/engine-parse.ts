// The handful of readers every workbook validator needs.
//
// They exist so the validators read as a list of rules rather than a list of
// `typeof` checks, and so a refusal always names where in the document it was
// raised. "Unknown key" is a refusal here, not a shrug: a field this module
// cannot validate must never reach the engine, and must never be dropped on
// the way to being saved.

import { isWorkbookRejection, rejectWorkbook } from "./engine-errors.ts";

function serialise(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== "string") rejectWorkbook("invalid_snapshot", "workbook is not a serialisable document");
    return json;
  } catch (error) {
    if (isWorkbookRejection(error)) throw error;
    rejectWorkbook("invalid_snapshot", `workbook cannot be serialised: ${(error as Error).message}`);
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readObject(value: unknown, at: string): Record<string, unknown> {
  if (!isPlainObject(value)) rejectWorkbook("invalid_snapshot", `${at} must be an object`, { at });
  return value;
}

/** Refuse any field outside the closed set this module knows how to check. */
export function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], at: string): void {
  const permitted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (permitted.has(key)) continue;
    rejectWorkbook(
      "invalid_snapshot",
      `${at} carries an unsupported field "${key}". Only ${allowed.join(", ")} are accepted, so a field this ` +
        "module cannot validate is refused rather than passed to the engine or silently discarded.",
      { at },
    );
  }
}

export function readString(value: unknown, at: string, maxLength: number): string {
  if (typeof value !== "string") rejectWorkbook("invalid_snapshot", `${at} must be a string`, { at });
  if (value.length > maxLength) {
    rejectWorkbook("too_large", `${at} is ${value.length} characters (max ${maxLength})`, { at });
  }
  return value;
}

export function readNonEmptyString(value: unknown, at: string, maxLength: number): string {
  const text = readString(value, at, maxLength);
  if (text.trim().length === 0) rejectWorkbook("invalid_snapshot", `${at} must not be blank`, { at });
  return text;
}

/**
 * A count the engine allocates against. Over the cap is `too_large` rather than
 * `invalid_snapshot`: the number is well formed, it is just more grid than one
 * job may ask for.
 */
export function readBoundedCount(value: unknown, at: string, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    rejectWorkbook("invalid_snapshot", `${at} must be an integer`, { at });
  }
  if (value < 1) rejectWorkbook("invalid_snapshot", `${at} must be at least 1, got ${value}`, { at });
  if (value > max) rejectWorkbook("too_large", `${at} is ${value} (max ${max})`, { at });
  return value;
}

const INDEX_KEY = /^(?:0|[1-9][0-9]*)$/;

/**
 * A `cellData` key. Univer stores the matrix as an object keyed by decimal
 * integers, so "01", "-1", "1.5" and "1e3" are all malformed rather than
 * merely unusual, and an index outside the declared grid is a document that
 * disagrees with itself.
 */
export function readIndexKey(key: string, at: string, exclusiveMax: number): number {
  if (!INDEX_KEY.test(key)) rejectWorkbook("invalid_snapshot", `${at} is not a row/column index`, { at });
  const index = Number(key);
  if (index >= exclusiveMax) {
    rejectWorkbook("invalid_snapshot", `${at} is outside the sheet's declared grid (max ${exclusiveMax - 1})`, { at });
  }
  return index;
}

/**
 * Serialised size of the candidate, measured before anything is walked.
 * A document that cannot be serialised at all (a cycle, a BigInt) is malformed.
 */
export function measureBytes(value: unknown, maxBytes: number): number {
  const bytes = Buffer.byteLength(serialise(value), "utf8");
  if (bytes > maxBytes) {
    rejectWorkbook(
      "too_large",
      `workbook is ${bytes} bytes (max ${maxBytes}). Split the change into smaller saves.`,
    );
  }
  return bytes;
}

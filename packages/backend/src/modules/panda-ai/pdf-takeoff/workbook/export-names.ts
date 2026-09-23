// Worksheet names an Excel file can actually carry, and the formulas that must
// still resolve after one of them changes.
//
// Generated worksheets are already safe — `buildGeneratedLayout` names them
// through `safeSheetName` and pins the result. A SCRATCH worksheet is not: the
// snapshot validator only asks that its name be non-empty, bounded and unique,
// so a person may legitimately call one `Rates 1:5 */ check` or give it sixty
// characters. Excel refuses both, and a file it refuses is not an export.
//
// So a name that Excel cannot hold is changed HERE, in the exported copy only —
// the persisted formula text is never rewritten, because rewriting what a QS
// stored is how a working bill silently becomes a wrong one. And because a
// cross-sheet formula spells the name it points at, changing one without
// changing every reference to it would turn `=SUM('Rates 1:5'!B2:B9)` into a
// `#REF!` — a wrong figure, quietly, in the file the client opens. Renaming and
// re-pointing are therefore one operation and cannot be done separately.

import { quoteSheetName } from "./hydrate.ts";
import { safeSheetName, uniqueSheetName } from "./layout.ts";
import type { WorkbookSnapshot } from "./engine-types.ts";

/** Excel's own change-tracking worksheet. A user sheet may not take the name. */
const RESERVED_SHEET_NAMES: readonly string[] = ["history"];

export interface ExcelSheetNames {
  /** Worksheet id -> the name the exported file uses for it. */
  readonly byId: ReadonlyMap<string, string>;
  /** Lower-cased snapshot name -> exported name, for the worksheets that moved. */
  readonly renamed: ReadonlyMap<string, string>;
  /** Every name now in use, lower-cased, so the cover sheet can pick a free one. */
  readonly taken: Set<string>;
}

export function excelSheetNames(snapshot: WorkbookSnapshot): ExcelSheetNames {
  const taken = new Set<string>(RESERVED_SHEET_NAMES);
  const byId = new Map<string, string>();
  const renamed = new Map<string, string>();

  snapshot.sheetOrder.forEach((sheetId, index) => {
    const original = snapshot.sheets[sheetId]?.name ?? `Sheet ${index + 1}`;
    const name = uniqueSheetName(safeSheetName(original, `Sheet ${index + 1}`), taken);
    byId.set(sheetId, name);
    if (name !== original) renamed.set(original.toLowerCase(), name);
  });

  return { byId, renamed, taken };
}

const NAME_START = /[A-Za-z_]/;
const NAME_PART = /[A-Za-z0-9_.]/;
/** A name here would be the tail of `Sheet1!A1`, `B.C` or `$A$1`, not a sheet reference. */
const REF_CONTINUATION = /[A-Za-z0-9_.$!]/;

/**
 * The index just past the quote that closes the one at `start`. A doubled quote
 * is an escape and does not close, which is why this is a walk and not an
 * `indexOf`. An unterminated literal returns the end of the string, so the
 * remainder is copied verbatim rather than reinterpreted as formula.
 */
function closingQuote(text: string, start: number, quote: string): number {
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === quote) {
      if (text[index + 1] === quote) {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return text.length;
}

function skipSpaces(text: string, from: number): number {
  let index = from;
  while (index < text.length && text[index] === " ") index += 1;
  return index;
}

/**
 * Re-point every cross-sheet reference at its exported worksheet name.
 *
 * It walks rather than replaces by regular expression because a worksheet name
 * can appear inside a string literal — a description cell reading
 * `"see Rates 1:5! for the build-up"` must come out of the export saying
 * exactly that. Nothing inside `"` is ever touched.
 *
 * A renamed reference always comes back QUOTED and escaped, whether or not it
 * arrived that way: the new name may contain a space where the old one did not.
 * A reference to a worksheet that kept its name is emitted as the caller wrote
 * it, so an untouched formula is byte-identical after this function.
 */
export function rewriteSheetRefs(formula: string, renamed: ReadonlyMap<string, string>): string {
  if (renamed.size === 0) return formula;

  const reference = (name: string, asWritten: string): string => {
    const replacement = renamed.get(name.toLowerCase());
    return replacement === undefined ? asWritten : quoteSheetName(replacement);
  };

  let out = "";
  let index = 0;
  while (index < formula.length) {
    const char = formula[index]!;

    if (char === '"') {
      const end = closingQuote(formula, index, '"');
      out += formula.slice(index, end);
      index = end;
      continue;
    }

    if (char === "'") {
      const end = closingQuote(formula, index, "'");
      const bang = skipSpaces(formula, end);
      if (formula[bang] === "!") {
        const name = formula.slice(index + 1, end - 1).replace(/''/g, "'");
        out += `${reference(name, formula.slice(index, end))}!`;
        index = bang + 1;
        continue;
      }
      out += formula.slice(index, end);
      index = end;
      continue;
    }

    if (NAME_START.test(char) && !REF_CONTINUATION.test(formula[index - 1] ?? "")) {
      let end = index + 1;
      while (end < formula.length && NAME_PART.test(formula[end]!)) end += 1;
      const bang = skipSpaces(formula, end);
      if (formula[bang] === "!") {
        const name = formula.slice(index, end);
        out += `${reference(name, name)}!`;
        index = bang + 1;
        continue;
      }
      out += formula.slice(index, end);
      index = end;
      continue;
    }

    out += char;
    index += 1;
  }
  return out;
}

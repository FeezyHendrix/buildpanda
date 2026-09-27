// Which formulas a takeoff workbook is allowed to contain.
//
// This is a safety scan over formula TEXT, not an evaluator and not a parser:
// it reads the function names and sheet references a formula mentions so an
// unsafe one can be refused before a worker is spawned. Every formula that
// passes is then calculated by Univer itself — this module never computes an
// arithmetic result, and there is no mini-language behind it.
//
// Two refusals matter most. A volatile or indirect function cannot have its
// dependency graph validated, so the cycle gate downstream would be checking a
// graph that does not describe what will actually be read. And an external
// function reaches off this server for a figure that then looks, in a saved
// bill, exactly like a measured one.
//
// NO EXTERNALS, AND THAT RULE OUTLIVES THIS PROCESS. A stored formula is not
// only calculated here — it is written verbatim into the XLSX export, and it is
// then opened by Excel on somebody else's machine, where the network and the
// add-in registry are wide open. So a function is refused when it would reach
// outside on EITHER side of that handover, whether or not this server could
// have executed it. That is why `IMAGE` and `HYPERLINK` are blocked despite
// having no backend egress at all, and why the `_xll.` add-in namespace is
// refused outright rather than resolved: what follows it is third-party code
// whose name tells us nothing.

import { rejectWorkbook } from "./engine-errors.ts";

/** Function name -> why a bill of quantities may not contain it. */
const BLOCKED_FUNCTIONS = new Map<string, string>([
  ["NOW", "volatile: the result moves with the clock, so a saved figure could never be reproduced"],
  ["TODAY", "volatile: the result moves with the clock, so a saved figure could never be reproduced"],
  ["RAND", "volatile: a quantity must not be random"],
  ["RANDBETWEEN", "volatile: a quantity must not be random"],
  ["RANDARRAY", "volatile: a quantity must not be random"],
  ["INDIRECT", "builds a reference from text, so its dependencies cannot be validated before calculation"],
  ["OFFSET", "builds a reference at calculation time, so its dependencies cannot be validated beforehand"],
  ["CELL", "reports the host environment rather than the measurement"],
  ["INFO", "reports the host environment rather than the measurement"],
  ["WEBSERVICE", "fetches from the network; a workbook figure must come from this project's own records"],
  ["FILTERXML", "parses fetched documents; a workbook figure must come from this project's own records"],
  ["ENCODEURL", "exists only to build network requests"],
  ["RTD", "streams from an external source"],
  ["IMPORTDATA", "imports from outside this workbook"],
  ["IMPORTRANGE", "imports from outside this workbook"],
  ["IMPORTXML", "imports from outside this workbook"],
  ["IMPORTHTML", "imports from outside this workbook"],
  ["IMPORTFEED", "imports from outside this workbook"],
  ["IMAGE", "loads a picture from a URL, so an exported bill would reach the network when a reader opens it"],
  [
    "HYPERLINK",
    "writes a clickable destination into the bill; an exported sheet would offer a reader a link this project never recorded",
  ],
  ["LAMBDA", "defines a callable function, which no dependency or safety contract here can validate"],
  ["CALL", "invokes external code"],
  ["EVALUATE", "invokes external code"],
  ["REGISTER.ID", "invokes external code"],
]);

/**
 * Namespace prefixes Excel writes in front of newer, worksheet-scoped and
 * user-defined functions, and which a workbook round-tripped through Excel
 * carries verbatim.
 *
 * They are NOT decoration: Univer resolves through them, so `_xlfn.RANDARRAY()`
 * really is `RANDARRAY()` and really does return different numbers on every
 * recalculation. A safety check that only knew the bare name therefore let
 * exactly the functions this module exists to refuse walk straight past it.
 */
const NAMESPACE_PREFIXES = ["_XLFN.", "_XLWS.", "_XLUDF.", "_XLOP."] as const;

/**
 * The function name with any chain of namespace prefixes removed.
 *
 * Prefixes are stripped one whole prefix at a time, from the front — never by
 * taking the last dotted segment. A blocked name can itself contain a dot, so
 * "last segment" would reduce `REGISTER.ID` to `ID` and miss it.
 */
function withoutNamespace(upperName: string): string {
  let name = upperName;
  for (;;) {
    const prefix = NAMESPACE_PREFIXES.find((candidate) => name.startsWith(candidate));
    if (prefix === undefined) return name;
    name = name.slice(prefix.length);
  }
}

/**
 * Namespaces where the namespace ITSELF is the refusal, because whatever
 * follows it is third-party code.
 *
 * Deliberately not in `NAMESPACE_PREFIXES`: those are stripped and the bare
 * name is then judged on its merits, which for an add-in would mean judging an
 * arbitrary vendor name against a list it will never appear on — i.e. letting
 * it through.
 */
const BLOCKED_NAMESPACES = new Map<string, string>([
  ["_XLL.", "resolves to an Excel add-in, which is third-party code no contract here can validate"],
]);

/** Why this function may not appear in a takeoff workbook, under any spelling. */
function blockedReason(upperName: string): string | undefined {
  const direct = BLOCKED_FUNCTIONS.get(upperName);
  if (direct !== undefined) return direct;

  const bare = withoutNamespace(upperName);
  for (const [prefix, why] of BLOCKED_NAMESPACES) {
    if (bare.startsWith(prefix)) return why;
  }
  return BLOCKED_FUNCTIONS.get(bare);
}

const STRING_LITERAL = /"(?:[^"]|"")*"/g;
const ERROR_LITERAL = /#(?:DIV\/0!|REF!|VALUE!|NAME\?|NUM!|NULL!|N\/A|SPILL!|CALC!|GETTING_DATA)/g;
const QUOTED_SHEET_REF = /'((?:[^']|'')*)'\s*!/g;
const BARE_SHEET_REF = /(?<![\w.$!])([A-Za-z_][A-Za-z0-9_.]*)\s*!/g;
const FUNCTION_CALL = /([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g;

/**
 * Formula text with string and error literals blanked out, so a description
 * that happens to read "measured NOW() on site" is not mistaken for a call.
 * Lengths are preserved only loosely; nothing downstream depends on offsets.
 */
function withoutLiterals(formula: string): string {
  return formula.replace(STRING_LITERAL, '""').replace(ERROR_LITERAL, "#ERR");
}

function unescapeSheetName(name: string): string {
  return name.replace(/''/g, "'");
}

export interface FormulaScan {
  /** Upper-cased function names the formula calls. */
  readonly functions: readonly string[];
  /** Worksheet names the formula references, as written. */
  readonly sheetRefs: readonly string[];
}

/** Read the structure a safety decision needs. No evaluation, no arithmetic. */
export function scanFormula(formula: string): FormulaScan {
  const stripped = withoutLiterals(formula);
  const sheetRefs: string[] = [];

  const withoutQuotedRefs = stripped.replace(QUOTED_SHEET_REF, (_match, name: string) => {
    sheetRefs.push(unescapeSheetName(name));
    return "@!";
  });
  for (const match of withoutQuotedRefs.matchAll(BARE_SHEET_REF)) {
    const name = match[1];
    if (name !== undefined) sheetRefs.push(name);
  }

  const functions: string[] = [];
  for (const match of withoutQuotedRefs.matchAll(FUNCTION_CALL)) {
    const name = match[1];
    if (name !== undefined) functions.push(name.toUpperCase());
  }

  return { functions, sheetRefs };
}

/**
 * Refuse a formula this workbook may not contain.
 *
 * @param sheetNames worksheet names of THIS workbook, lower-cased. Excel
 *   references are case-insensitive, and a reference that resolves to nothing
 *   here is a reference to another document.
 */
export function assertFormulaSupported(formula: string, at: string, sheetNames: ReadonlySet<string>): void {
  if (!formula.startsWith("=")) {
    rejectWorkbook("invalid_snapshot", `${at} holds formula text that does not start with "=": ${formula}`, { at });
  }

  const stripped = withoutLiterals(formula);
  if (stripped.includes("[")) {
    rejectWorkbook(
      "unsupported_formula",
      `${at} references another workbook. A takeoff formula may only reference this workbook.`,
      { at },
    );
  }

  const { functions, sheetRefs } = scanFormula(formula);

  for (const name of functions) {
    const why = blockedReason(name);
    if (why !== undefined) {
      rejectWorkbook("unsupported_formula", `${at} calls ${name}(), which is not supported here — ${why}.`, { at });
    }
  }

  for (const ref of sheetRefs) {
    if (sheetNames.has(ref.toLowerCase())) continue;
    rejectWorkbook(
      "unsupported_formula",
      `${at} references worksheet "${ref}", which is not part of this workbook.`,
      { at },
    );
  }
}

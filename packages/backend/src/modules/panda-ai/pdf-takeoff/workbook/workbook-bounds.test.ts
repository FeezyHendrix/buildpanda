import assert from "node:assert/strict";
import { test } from "node:test";
import { isWorkbookRejection } from "./engine-errors.ts";
import { WORKBOOK_LIMITS } from "./engine-limits.ts";
import { validateWorkbookSnapshot } from "./engine-validation.ts";

// The boundary a browser hands this module across. Everything here runs before
// a worker is spawned and before Univer sees a single cell, because the whole
// point of the gate is that an over-large or malformed document costs a JSON
// parse and nothing else — no engine boot, no queue slot, no thread.
//
// Every figure asserted below is the contract's own number, not a convenience:
// 10000 populated cells, 50 worksheets, 2 MiB of input, 4096 characters of
// formula. A test that accepted "some limit, roughly" would not catch the
// limit being quietly widened.

/** Smallest snapshot that is actually valid, so each case changes exactly one thing. */
function baseSnapshot(): Record<string, unknown> {
  return {
    id: "wb-1",
    name: "Takeoff",
    sheetOrder: ["s1"],
    sheets: {
      s1: {
        id: "s1",
        name: "Takeoff",
        rowCount: 100,
        columnCount: 10,
        cellData: { 0: { 0: { v: 24 }, 1: { f: "=A1*2" } } },
      },
    },
  };
}

/** The reason a rejection carried, or `null` when the call did not reject at all. */
function rejectionOf(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    if (!isWorkbookRejection(error)) throw error;
    return error.reason;
  }
}

test("a valid snapshot survives validation with its formulas and values intact", () => {
  const snapshot = validateWorkbookSnapshot(baseSnapshot());
  assert.equal(snapshot.id, "wb-1");
  assert.deepEqual([...snapshot.sheetOrder], ["s1"]);
  const sheet = snapshot.sheets.s1;
  assert.ok(sheet, "the sheet named in sheetOrder is present");
  assert.equal(sheet.cellData[0]?.[0]?.v, 24, "a literal is carried through untouched");
  assert.equal(sheet.cellData[0]?.[1]?.f, "=A1*2", "formula text is never rewritten by validation");
});

test("validation refuses a document that is not a workbook at all", () => {
  for (const junk of [null, 42, "wb", [], { id: "x" }]) {
    assert.equal(rejectionOf(() => validateWorkbookSnapshot(junk)), "invalid_snapshot", `rejected ${JSON.stringify(junk)}`);
  }
});

test("an unmodelled field is refused, never silently dropped", () => {
  // Forwarding a vendor field this module cannot validate is how an untrusted
  // document reaches the engine unchecked; dropping it silently is how a user's
  // work disappears on save. Both are refusals.
  const withExtra = { ...baseSnapshot(), resources: [{ name: "anything", data: "{}" }] };
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(withExtra)), "invalid_snapshot");

  const cellExtra = baseSnapshot();
  const sheets = cellExtra.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
  sheets.s1!.cellData[0]![0] = { v: 24, custom: { bpRowId: "row-7" } };
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(cellExtra)), "invalid_snapshot");
});

test("sheetOrder and sheets must describe exactly the same worksheets", () => {
  const dangling = baseSnapshot();
  dangling.sheetOrder = ["s1", "s2"];
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(dangling)), "invalid_snapshot");

  const orphan = baseSnapshot();
  (orphan.sheets as Record<string, unknown>).s2 = {
    id: "s2",
    name: "Orphan",
    rowCount: 10,
    columnCount: 10,
    cellData: {},
  };
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(orphan)), "invalid_snapshot");
});

test("51 worksheets is refused and 50 is accepted", () => {
  const build = (count: number): Record<string, unknown> => {
    const sheets: Record<string, unknown> = {};
    const order: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = `s${i}`;
      order.push(id);
      sheets[id] = { id, name: `Sheet ${i}`, rowCount: 10, columnCount: 10, cellData: {} };
    }
    return { id: "wb-1", name: "Takeoff", sheetOrder: order, sheets };
  };
  assert.equal(WORKBOOK_LIMITS.maxSheets, 50, "the contract's worksheet cap");
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(build(50))), null, "50 worksheets is inside the cap");
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(build(51))), "too_large");
});

test("10001 populated cells is refused and 10000 is accepted", () => {
  const build = (count: number): Record<string, unknown> => {
    const cellData: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 20);
      const column = i % 20;
      (cellData[row] ??= {})[column] = { v: i };
    }
    return {
      id: "wb-1",
      name: "Takeoff",
      sheetOrder: ["s1"],
      sheets: { s1: { id: "s1", name: "Takeoff", rowCount: 2000, columnCount: 20, cellData } },
    };
  };
  assert.equal(WORKBOOK_LIMITS.maxPopulatedCells, 10_000, "the contract's populated-cell cap");
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(build(10_000))), null);
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(build(10_001))), "too_large");
});

test("a formula longer than 4096 characters is refused", () => {
  assert.equal(WORKBOOK_LIMITS.maxFormulaLength, 4096, "the contract's formula-length cap");
  const atCap = `=${"1+".repeat(2047)}1`;
  assert.equal(atCap.length, 4096);
  const overCap = `${atCap}+1`;

  const ok = baseSnapshot();
  const okSheets = ok.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
  okSheets.s1!.cellData[0]![1] = { f: atCap };
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(ok)), null);

  const tooLong = baseSnapshot();
  const longSheets = tooLong.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
  longSheets.s1!.cellData[0]![1] = { f: overCap };
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(tooLong)), "too_large");
});

test("a document over 2 MiB is refused before anything is walked", () => {
  assert.equal(WORKBOOK_LIMITS.maxInputBytes, 2 * 1024 * 1024, "the contract's input-byte cap");
  const fat = baseSnapshot();
  const sheets = fat.sheets as Record<string, { name: string }>;
  // One oversized string: cheap to build, and it must be refused on bytes even
  // though the cell count is tiny.
  sheets.s1!.name = "x".repeat(3 * 1024 * 1024);
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(fat)), "too_large");
});

test("a row or column index outside the sheet's declared grid is refused", () => {
  const outside = baseSnapshot();
  const sheets = outside.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
  sheets.s1!.cellData[500] = { 0: { v: 1 } }; // rowCount is 100
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(outside)), "invalid_snapshot");
});

test("a sheet cannot declare a grid large enough to be an allocation attack", () => {
  const huge = baseSnapshot();
  const sheets = huge.sheets as Record<string, { rowCount: number; columnCount: number }>;
  sheets.s1!.rowCount = 1_000_000_000;
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(huge)), "too_large");

  const wide = baseSnapshot();
  (wide.sheets as Record<string, { columnCount: number }>).s1!.columnCount = 100_000;
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(wide)), "too_large");
});

test("a non-finite literal is refused rather than stored as a number", () => {
  // JSON cannot carry NaN, but a JS caller inside the process can, and a
  // literal Infinity would be read back out of the engine as a real figure.
  const bad = baseSnapshot();
  const sheets = bad.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
  sheets.s1!.cellData[0]![0] = { v: Number.POSITIVE_INFINITY };
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(bad)), "invalid_snapshot");
});

test("the takeoff formulas this workbook is for are all supported", () => {
  // Narrowing the engine to two functions would satisfy every rejection test
  // above and be useless for a bill of quantities, so the supported surface is
  // asserted explicitly.
  const supported = [
    "=SUM(B7:B9)",
    "=(B2-B3)*B4",
    "=ROUND(B3/1000,1)",
    '=IF(B3>100000,"OVER","UNDER")',
    "=Takeoff!B5",
    "='Takeoff Rev B'!B5",
    "=SUM(Takeoff!B2:B4)*1.1",
    "=ROUND(IF(SUM(B7:B9)>0,SUM(B7:B9)*Rates!B2,0),2)",
  ];
  for (const formula of supported) {
    const snapshot = baseSnapshot();
    snapshot.sheetOrder = ["s1", "s2", "s3"];
    const sheets = snapshot.sheets as Record<string, unknown>;
    sheets.s2 = { id: "s2", name: "Takeoff Rev B", rowCount: 10, columnCount: 10, cellData: {} };
    sheets.s3 = { id: "s3", name: "Rates", rowCount: 10, columnCount: 10, cellData: {} };
    const s1 = sheets.s1 as { cellData: Record<string, Record<string, unknown>> };
    s1.cellData[0]![1] = { f: formula };
    assert.equal(rejectionOf(() => validateWorkbookSnapshot(snapshot)), null, `${formula} must be supported`);
  }
});

test("volatile, indirect and external formulas are refused by name", () => {
  const refused = [
    "=NOW()",
    "=TODAY()",
    "=RAND()",
    "=RANDBETWEEN(1,10)",
    "=INDIRECT(\"A\"&B1)",
    "=OFFSET(A1,1,1)",
    "=WEBSERVICE(\"https://example.com\")",
    "=FILTERXML(A1,\"//x\")",
    "=IMPORTRANGE(\"key\",\"A1\")",
    "=CELL(\"filename\")",
    "=INFO(\"osversion\")",
    "=LAMBDA(x,x*2)(3)",
    "=SUM([Book2.xlsx]Sheet1!A1:A5)",
    "=Missing!A1",
  ];
  for (const formula of refused) {
    const snapshot = baseSnapshot();
    const sheets = snapshot.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
    sheets.s1!.cellData[0]![1] = { f: formula };
    assert.equal(
      rejectionOf(() => validateWorkbookSnapshot(snapshot)),
      "unsupported_formula",
      `${formula} must be refused explicitly`,
    );
  }
});

test("a namespace-prefixed unsafe function is refused, not smuggled past the name check", () => {
  // Excel writes newer and worksheet-scoped functions with an `_xlfn.` /
  // `_xlws.` / `_xludf.` prefix, and a file round-tripped through Excel carries
  // those prefixes verbatim. `_xlfn.RANDARRAY()` still produces different
  // numbers on every recalculation, so a check that only knew the bare name let
  // exactly the formulas this module exists to refuse straight through.
  const refused = [
    "=_xlfn.RANDARRAY(1,1)",
    "=_XLFN.RAND()",
    "=_xlws.NOW()",
    "=_XLWS.TODAY()",
    "=_xlfn.INDIRECT(\"A1\")",
    "=_xlfn.OFFSET(A1,1,1)",
    "=_xlfn.WEBSERVICE(\"https://example.com\")",
    "=_xludf.LAMBDA(x,x*2)(3)",
    "=_xlfn.CELL(\"filename\")",
    // Prefix chains, and a blocked name that itself contains a dot: stripping
    // to the last dotted segment would leave "ID" and miss REGISTER.ID.
    "=_xlfn._xlws.RAND()",
    "=_xlfn.REGISTER.ID(\"a\",\"b\")",
    "=REGISTER.ID(\"a\",\"b\")",
  ];
  for (const formula of refused) {
    const snapshot = baseSnapshot();
    const sheets = snapshot.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
    sheets.s1!.cellData[0]![1] = { f: formula };
    assert.equal(
      rejectionOf(() => validateWorkbookSnapshot(snapshot)),
      "unsupported_formula",
      `${formula} must be refused explicitly`,
    );
  }
});

test("a formula that would reach outside once EXPORTED is refused too", () => {
  // Neither of these has any backend egress — Univer will not fetch for them
  // here. They are refused because a stored formula is written verbatim into
  // the XLSX export and then opened by Excel on somebody else's machine, where
  // the network is wide open. The refusal has to happen before the save, or the
  // export has no honest way to publish the bill.
  const refused = [
    '=IMAGE("https://example.com/logo.png")',
    '=_xlfn.IMAGE("https://example.com/logo.png")',
    '=HYPERLINK("https://example.com","click")',
    '=_XLFN.HYPERLINK("https://example.com")',
    // An add-in: the namespace is the refusal, because the name after it is a
    // third-party symbol that no allow-list could ever meaningfully cover.
    '=_xll.MyVendorFunc(A1)',
    '=_XLL.ANYTHING()',
    '=_xlfn._xll.Wrapped(A1)',
  ];
  for (const formula of refused) {
    const snapshot = baseSnapshot();
    const sheets = snapshot.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
    sheets.s1!.cellData[0]![1] = { f: formula };
    assert.equal(
      rejectionOf(() => validateWorkbookSnapshot(snapshot)),
      "unsupported_formula",
      `${formula} must be refused explicitly`,
    );
  }
});

test("ordinary dotted function names are still allowed", () => {
  // The add-in check matches a NAMESPACE, not any dot. `CEILING.MATH` and
  // `NORM.DIST` are real Excel functions a QS legitimately uses, and blocking
  // dotted names wholesale would take them with it.
  const allowed = [
    "=CEILING.MATH(A1,0.05)",
    "=NORM.DIST(A1,0,1,TRUE)",
    "=FLOOR.MATH(A1)",
    "=_xlfn.CEILING.MATH(A1,0.05)",
    // The blocked names as TEXT are just words in a bill.
    '=IF(A1>0,"IMAGE(x) not permitted","HYPERLINK(y) not permitted")',
    '=CONCATENATE("_xll.","note")',
  ];
  for (const formula of allowed) {
    const snapshot = baseSnapshot();
    const sheets = snapshot.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
    sheets.s1!.cellData[0]![1] = { f: formula };
    assert.equal(rejectionOf(() => validateWorkbookSnapshot(snapshot)), null, `${formula} must be accepted`);
  }
});

test("a namespace prefix on a SAFE function is not a reason to refuse it", () => {
  // Over-blocking every prefixed name would refuse ordinary workbooks that have
  // been through Excel. An unknown-but-safe name is the engine's problem, not a
  // safety refusal.
  const allowed = ["=_xlfn.XLOOKUP(A1,B1:B9,C1:C9)", "=_xlfn.CONCAT(A1,B1)", "=_xlfn.IFS(A1>0,1,TRUE,0)"];
  for (const formula of allowed) {
    const snapshot = baseSnapshot();
    const sheets = snapshot.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
    sheets.s1!.cellData[0]![1] = { f: formula };
    assert.equal(rejectionOf(() => validateWorkbookSnapshot(snapshot)), null, `${formula} must be accepted`);
  }
});

test("a prefixed function name inside a string literal is still not a rejection", () => {
  const snapshot = baseSnapshot();
  const sheets = snapshot.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
  sheets.s1!.cellData[0]![1] = { f: '=IF(B1>0,"_xlfn.NOW() was noted","_XLFN.INDIRECT(x)")' };
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(snapshot)), null);
});

test("a function name appearing inside a string literal is not a rejection", () => {
  // The safety scan reads formula structure, so a description that happens to
  // contain "NOW(" must not cost the user their save.
  const snapshot = baseSnapshot();
  const sheets = snapshot.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
  sheets.s1!.cellData[0]![1] = { f: '=IF(B1>0,"measured NOW() on site","INDIRECT(x)")' };
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(snapshot)), null);
});

test("a formula cell must carry a formula, not an expression pretending to be one", () => {
  const snapshot = baseSnapshot();
  const sheets = snapshot.sheets as Record<string, { cellData: Record<string, Record<string, unknown>> }>;
  sheets.s1!.cellData[0]![1] = { f: "SUM(B7:B9)" }; // no leading '='
  assert.equal(rejectionOf(() => validateWorkbookSnapshot(snapshot)), "invalid_snapshot");
});

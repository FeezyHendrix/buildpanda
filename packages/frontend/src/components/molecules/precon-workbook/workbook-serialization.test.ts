// What the browser may send: narrowing Univer's document, and round-tripping an
// untouched workbook so every generated cell still agrees with the bill.
//
// Written against the backend's own rule (`workbook/sanitize.ts`): a generated
// cell must agree on `v`, `f` and `t`, `s` is ignored, and one disagreement
// refuses the WHOLE save.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCandidate, isSendable } from "./candidate";
import { sameMeaning } from "./protected";
import { narrowCell, narrowWorkbook, toUniverWorkbook } from "./snapshot-io";
import type { RawWorkbookData } from "./snapshot-io";
import { BILL, document, rawFrom, setCell, SUMMARY } from "./workbook-fixture";
import { GENERATED_EDITABLE_STYLE_ID, GENERATED_STYLE_ID, HEADER_STYLE_ID } from "./workbook-styles";
import type { WorkbookCell } from "@/api/workbook-types";
describe("narrowing Univer's document", () => {
  it("drops the cached figure from a formula cell, so a generated total still matches", () => {
    const { cell } = narrowCell({ f: "=SUM(A1:A2)", v: 3670, t: 2 }, new (class {
      idFor(): undefined {
        return undefined;
      }
      entries(): Record<string, never> {
        return {};
      }
    })() as never);
    assert.deepEqual(cell, { f: "=SUM(A1:A2)" });
  });

  it("refuses to carry a shared formula rather than losing it", () => {
    const doc = document();
    const raw = rawFrom(doc);
    setCell(raw, "scratch-1", 4, 0, { si: "shared-1", v: 12, t: 2 });
    const { notes } = narrowWorkbook(raw, doc.snapshot);
    assert.equal(notes.length, 1);
    assert.match(notes[0]!.reason, /shares a formula/);
  });

  it("hoists an inline style object into the style table instead of dropping formatting", () => {
    const doc = document();
    const raw = rawFrom(doc);
    setCell(raw, "scratch-1", 0, 0, { v: 1, t: 2, s: { bl: 1 } });
    setCell(raw, "scratch-1", 0, 1, { v: 2, t: 2, s: { bl: 1 } });
    const { snapshot, notes } = narrowWorkbook(raw, doc.snapshot);
    assert.deepEqual(notes, []);
    const line = snapshot.sheets["scratch-1"]!.cellData["0"]!;
    assert.equal(line["0"]!.s, line["1"]!.s, "identical formatting must share one style id");
    assert.deepEqual(snapshot.styles[line["0"]!.s!], { bl: 1 });
  });

  it("strips every vendor field the API's closed cell grammar refuses", () => {
    const doc = document();
    const { snapshot } = narrowWorkbook(rawFrom(doc), doc.snapshot);
    for (const sheet of Object.values(snapshot.sheets)) {
      assert.deepEqual(Object.keys(sheet).sort(), ["cellData", "columnCount", "id", "name", "rowCount"]);
      for (const line of Object.values(sheet.cellData)) {
        for (const cell of Object.values(line)) {
          for (const key of Object.keys(cell)) assert.ok(["v", "f", "s", "t"].includes(key), `leaked ${key}`);
        }
      }
    }
  });
});

describe("an untouched workbook", () => {
  it("round-trips to a candidate every generated cell of which still agrees with the bill", () => {
    const doc = document();
    const candidate = buildCandidate(rawFrom(doc), doc);
    assert.deepEqual(candidate.blocked, []);
    assert.deepEqual(candidate.notes, []);
    assert.deepEqual(candidate.rowPatches, []);
    assert.ok(isSendable(candidate));

    for (const layout of doc.layout.sheets) {
      if (layout.kind === "scratch") continue;
      const before = doc.snapshot.sheets[layout.sheetId]!;
      const after = candidate.snapshot.sheets[layout.sheetId]!;
      for (const [row, line] of Object.entries(before.cellData)) {
        for (const [column, cell] of Object.entries(line)) {
          if (Number(column) >= layout.freeColumnStart) continue;
          assert.ok(
            sameMeaning(cell, after.cellData[row]?.[column]),
            `${layout.name}!${row}:${column} — ${JSON.stringify(cell)} vs ${JSON.stringify(after.cellData[row]?.[column])}`,
          );
        }
      }
    }
  });

  it("keeps the worksheet order and the pinned worksheet names", () => {
    const doc = document();
    const candidate = buildCandidate(rawFrom(doc), doc);
    assert.deepEqual(candidate.snapshot.sheetOrder, [SUMMARY, BILL, "scratch-1"]);
    assert.equal(candidate.snapshot.sheets[BILL]!.name, "Bill No. 1");
  });
});

describe("a person's own work", () => {
  it("carries a free-column formula through untouched", () => {
    const doc = document();
    const raw = setCell(rawFrom(doc), BILL, 1, 6, { f: "=D2*2", v: 48, t: 2 });
    const candidate = buildCandidate(raw, doc);
    assert.ok(isSendable(candidate));
    assert.deepEqual(candidate.snapshot.sheets[BILL]!.cellData["1"]!["6"], { f: "=D2*2" });
  });

  it("carries a new scratch worksheet", () => {
    const doc = document();
    const raw = rawFrom(doc);
    (raw.sheets as Record<string, unknown>)["sheet-new"] = {
      id: "sheet-new",
      name: "Rates",
      rowCount: 20,
      columnCount: 8,
      cellData: { "0": { "0": { f: "=SUM('Bill No. 1'!F2:F3)" } } },
    };
    (raw.sheetOrder as string[]).push("sheet-new");
    const candidate = buildCandidate(raw, doc);
    assert.ok(isSendable(candidate));
    assert.deepEqual(candidate.snapshot.sheets["sheet-new"]!.cellData["0"]!["0"], { f: "=SUM('Bill No. 1'!F2:F3)" });
  });
});

describe("the document handed to Univer", () => {
  it("carries every figure and formula verbatim, so the grid agrees with the API", () => {
    const doc = document();
    const input = toUniverWorkbook(doc);
    assert.deepEqual(input.sheetOrder, [SUMMARY, BILL, "scratch-1"]);
    // `v` absent is the point: Univer recalculates, so no cached figure ships.
    const total = input.sheets[SUMMARY]!.cellData["0"]!["1"]!;
    assert.equal(total.f, "=SUM(B3:B3)");
    assert.equal(total.v, undefined);
    assert.equal(input.sheets[BILL]!.cellData["1"]!["3"]!.v, 24);
  });

  it("marks a measured cell as generated and a rate as one a person may move", () => {
    const input = toUniverWorkbook(document());
    const line = input.sheets[BILL]!.cellData["1"]!;
    assert.equal(line["3"]!.s, GENERATED_STYLE_ID, "the quantity is the server's");
    assert.equal(line["4"]!.s, GENERATED_EDITABLE_STYLE_ID, "the rate is the user's to move");
    assert.equal(input.sheets[BILL]!.cellData["0"]!["0"]!.s, HEADER_STYLE_ID);
    for (const id of [GENERATED_STYLE_ID, GENERATED_EDITABLE_STYLE_ID, HEADER_STYLE_ID]) {
      assert.ok(input.styles[id], `style ${id} must be declared, or every cell using it is refused`);
    }
  });

  it("leaves a scratch worksheet unstyled: it is the user's outright", () => {
    const doc = document();
    const scratch = doc.snapshot.sheets["scratch-1"]!.cellData as Record<string, Record<string, WorkbookCell>>;
    scratch["0"] = { "0": { v: 1, t: 2 } };
    assert.equal(toUniverWorkbook(doc).sheets["scratch-1"]!.cellData["0"]!["0"]!.s, undefined);
  });

  it("survives the round trip: styling it added never becomes a protected-cell refusal", () => {
    const doc = document();
    const opened = toUniverWorkbook(doc);
    const raw: RawWorkbookData = {
      id: opened.id,
      name: opened.name,
      sheetOrder: [...opened.sheetOrder],
      styles: opened.styles,
      sheets: Object.fromEntries(
        Object.entries(opened.sheets).map(([id, sheet]) => [id, { ...sheet, cellData: sheet.cellData }]),
      ),
    };
    const candidate = buildCandidate(raw, doc);
    assert.deepEqual(candidate.blocked, []);
    assert.deepEqual(candidate.notes, []);
  });

  it("widens the description column, because a bill line is not a figure", () => {
    const input = toUniverWorkbook(document());
    assert.ok(input.sheets[BILL]!.columnData["1"]!.w > input.sheets[BILL]!.defaultColumnWidth);
  });
});

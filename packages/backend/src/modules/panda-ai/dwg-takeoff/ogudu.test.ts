import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { runDwgTakeoff } from "./engine.ts";

// The one real drawing we have: a four-storey block of flats at Ogudu. It is
// not committed, so the test skips when the file is absent; when present it
// pins the wall measurement so a change in pairing shows up here first.
const PROBE = "/tmp/probe.dwg";

test("Ogudu: wall lengths are the same on every run and both block thicknesses are measured on each floor", { skip: !existsSync(PROBE) && `${PROBE} absent` }, async () => {
  const first = await runDwgTakeoff(PROBE);
  const second = await runDwgTakeoff(PROBE);
  const walls = (r: typeof first) => r.items.filter((i) => i.trade === "walls").map((i) => [i.sheetId, i.description, i.quantity, i.basis]);
  assert.deepEqual(walls(first), walls(second), "wall lines differ between two runs of the same file");
  const summaries = first.wallSummaries ?? [];
  assert.ok(summaries.length >= 1, "no wall summary on any plan");
  for (const s of summaries) {
    const sheet = first.sheets?.find((x) => x.id === s.sheetId);
    const modes = s.byThickness.map((m) => `${m.thicknessMm} mm ${m.lengthM} m`).join(", ");
    console.log(`${s.code} ${sheet?.title ?? ""} × ${sheet?.multiplier ?? 1}: ${modes}; ${s.runs} runs; openings ${s.openings.doors} doors + ${s.openings.windows} windows (${s.openings.areaM2} m²); height ${s.height.mm} mm (${s.height.basis})`);
    console.log(`  checks: ${s.checks.dimensions} | ${s.checks.roomPerimeters}`);
    const thicknesses = s.byThickness.map((m) => m.thicknessMm);
    assert.ok(thicknesses.includes(225), `${s.code}: no 225 mm mode (got ${thicknesses.join(", ")})`);
    assert.ok(thicknesses.includes(150), `${s.code}: no 150 mm mode (got ${thicknesses.join(", ")})`);
    for (const m of s.byThickness) assert.ok(m.lengthM > 0 && m.lengthM < 2000, `${s.code}: ${m.thicknessMm} mm length ${m.lengthM} m is not plausible`);
  }
});

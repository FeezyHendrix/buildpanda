import { test } from "node:test";
import assert from "node:assert/strict";
import { measureRooms, statedAreaNote, type RoomResult } from "./rooms.ts";
import { buildRegister } from "./register.ts";
import { inferUnits } from "./units.ts";
import { proposeLayerMap } from "./taxonomy.ts";
import { wallSegments } from "./walls.ts";
import { smallBuilding, synth } from "./fixtures.ts";

test("rooms flood fill inside the wall faces from their labels; door openings are sealed by the leaf and swing", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  s.text("TEXT", [4000, -4000], "AREA OF FLAT IS 80 SQM");
  const doc = s.doc();
  const units = inferUnits(doc);
  const map = proposeLayerMap(doc, units.scaleToMm).map;
  const sheet = buildRegister(doc, units, map).find((x) => x.kind === "floor-plan")!;
  const rooms = measureRooms(doc, sheet, wallSegments(doc, sheet, map), units, map);
  assert.deepEqual(rooms.items.map((i) => i.description.split(" — ")[0]).sort(), ["BEDROOM", "LOUNGE"]);
  for (const room of rooms.items) assert.ok(room.quantity > 30 && room.quantity < 60, `${room.description} = ${room.quantity}`);
  assert.equal(rooms.statedM2, 80);
  assert.equal(rooms.perUnit, true);
  assert.deepEqual(rooms.unmeasured, []);
});

const result = (over: Partial<RoomResult>): RoomResult => ({
  items: [],
  totalM2: 0,
  statedM2: null,
  statedText: null,
  perUnit: false,
  units: 1,
  unmeasured: [],
  ...over,
});

test("the stated-area note says agree, differ, or which number of flats the sum fits", () => {
  assert.equal(statedAreaNote(result({ totalM2: 158, statedM2: 163 }), "DWG-01"), "DWG-01: rooms sum to 158 m²; sheet states 163 m² (agree).");
  assert.match(statedAreaNote(result({ totalM2: 100, statedM2: 163 }), "DWG-01") ?? "", /differ by 39%/);
  assert.match(statedAreaNote(result({ totalM2: 320, statedM2: 163, perUnit: true, units: 2 }), "DWG-01") ?? "", /fits 2 flats \(2 kitchens labelled\)/);
  const off = statedAreaNote(result({ totalM2: 240, statedM2: 163, perUnit: true, units: 2, unmeasured: ["TERRACE", "TERRACE"] }), "DWG-01") ?? "";
  assert.match(off, /× 2 labelled kitchens = 326 m² \(differ by 26%/);
  assert.match(off, /Not enclosed by the fill: TERRACE ×2/);
  assert.equal(statedAreaNote(result({ totalM2: 0, statedM2: 163 }), "DWG-01"), null);
});

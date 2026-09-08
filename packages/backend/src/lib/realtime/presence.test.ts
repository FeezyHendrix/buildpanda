import { test } from "node:test";
import assert from "node:assert/strict";
import { PresenceTracker } from "./presence.ts";

const ada = { id: "u_ada", name: "Ada" };
const bayo = { id: "u_bayo", name: "Bayo" };

test("presence: join and leave keep one entry per user across several sockets", () => {
  const p = new PresenceTracker();
  assert.deepEqual(p.join("precon:s1", ada), [{ id: "u_ada", name: "Ada", rowId: null }]);
  // a second tab for the same user changes nothing visible
  assert.equal(p.join("precon:s1", ada), null);
  assert.deepEqual(p.join("precon:s1", bayo)!.map((u) => u.id), ["u_ada", "u_bayo"]);
  // closing one of Ada's two tabs keeps her on the session
  assert.equal(p.leave("precon:s1", "u_ada"), null);
  assert.deepEqual(p.list("precon:s1").map((u) => u.id), ["u_ada", "u_bayo"]);
  // closing the last one removes her
  assert.deepEqual(p.leave("precon:s1", "u_ada")!.map((u) => u.id), ["u_bayo"]);
  // leaving twice, or a channel never joined, is not a change
  assert.equal(p.leave("precon:s1", "u_ada"), null);
  assert.equal(p.leave("precon:other", "u_bayo"), null);
  assert.deepEqual(p.leave("precon:s1", "u_bayo"), []);
  assert.deepEqual(p.list("precon:s1"), []);
});

test("presence: channels are independent", () => {
  const p = new PresenceTracker();
  p.join("precon:s1", ada);
  p.join("precon:s2", bayo);
  assert.deepEqual(p.list("precon:s1").map((u) => u.id), ["u_ada"]);
  assert.deepEqual(p.list("precon:s2").map((u) => u.id), ["u_bayo"]);
});

test("presence: focus moves a present user's row and is a no-op for absent users or unchanged rows", () => {
  const p = new PresenceTracker();
  p.join("precon:s1", ada);
  assert.deepEqual(p.focus("precon:s1", "u_ada", "pbr_1"), [{ id: "u_ada", name: "Ada", rowId: "pbr_1" }]);
  assert.equal(p.focus("precon:s1", "u_ada", "pbr_1"), null);
  assert.deepEqual(p.focus("precon:s1", "u_ada", null), [{ id: "u_ada", name: "Ada", rowId: null }]);
  assert.equal(p.focus("precon:s1", "u_bayo", "pbr_1"), null);
  assert.deepEqual(p.list("precon:s1").map((u) => u.id), ["u_ada"]);
});

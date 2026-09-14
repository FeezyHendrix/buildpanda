import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PreconSession, PreconSheet } from "@/api/precon";
import type { ProposalPlan } from "@/api/proposals";
import { PRECON_TOOL_BY_KEY } from "@/lib/precon-meta";
import { matchingSheet, previousSessionFor } from "./revision-chain";
import { blockedReasonFor } from "./tool-availability";

const sheet = (over: Partial<PreconSheet>): PreconSheet =>
  ({ id: "s1", sessionId: "x", fileName: "plan.pdf", pageNumber: 1, code: "A-01", title: null, kind: "floor-plan", status: "measured", scaleMmPerPt: 35, scaleConfidence: 1, dimUnit: "mm", geoSummary: null, error: null, ...over }) as PreconSheet;
const row = { id: "r1", version: 1 } as unknown as Parameters<typeof blockedReasonFor>[2];

describe("blockedReasonFor", () => {
  it("never blocks the toggles and holds", () => {
    for (const key of ["select", "legend", "magnifier", "overlay"] as const) assert.equal(blockedReasonFor(PRECON_TOOL_BY_KEY[key], null, null), null, key);
  });

  it("needs a sheet, then a scale, then a line — and says which", () => {
    assert.match(blockedReasonFor(PRECON_TOOL_BY_KEY.area, null, null) ?? "", /Open a sheet/);
    assert.match(blockedReasonFor(PRECON_TOOL_BY_KEY.area, sheet({ scaleMmPerPt: null }), null) ?? "", /scale first/);
    assert.equal(blockedReasonFor(PRECON_TOOL_BY_KEY.area, sheet({}), null), null);
    assert.match(blockedReasonFor(PRECON_TOOL_BY_KEY.typical, sheet({}), null) ?? "", /Select a bill line/);
    assert.equal(blockedReasonFor(PRECON_TOOL_BY_KEY.typical, sheet({}), row), null);
  });

  it("lets Set scale and Viewport run on a sheet with no scale yet", () => {
    assert.equal(blockedReasonFor(PRECON_TOOL_BY_KEY.scale, sheet({ scaleMmPerPt: null }), null), null);
    assert.equal(blockedReasonFor(PRECON_TOOL_BY_KEY.viewports, sheet({ scaleMmPerPt: null }), null), null);
  });

  it("keeps Room fill and Find symbol off a photograph", () => {
    assert.match(blockedReasonFor(PRECON_TOOL_BY_KEY.room_fill, sheet({ fileName: "site.jpg" }), null) ?? "", /vector drawing/);
    assert.equal(blockedReasonFor(PRECON_TOOL_BY_KEY.find_symbol, sheet({ fileName: "plan.dwg" }), null), null);
  });
});

const plan = (id: string, supersedesPlanId: string | null, revision: string | null): ProposalPlan => ({ id, supersedesPlanId, revision }) as ProposalPlan;
const session = (id: string, planId: string, takeoffKind: PreconSession["takeoffKind"], revision: number): PreconSession => ({ id, planId, takeoffKind, revision }) as PreconSession;

describe("previousSessionFor", () => {
  const plans = [plan("p1", null, "A"), plan("p2", "p1", "B")];
  const current = session("cur", "p2", "manual", 1);

  it("follows the plan chain to the latest take-off of the same kind on the superseded plan", () => {
    const sessions = [current, session("ai", "p1", "pdf", 3), session("m1", "p1", "manual", 1), session("m2", "p1", "manual", 2)];
    const found = previousSessionFor(current, plans, sessions);
    assert.equal(found?.session.id, "m2");
    assert.equal(found?.plan.revision, "A");
  });

  it("falls back to any kind when none of the same kind was measured", () => {
    assert.equal(previousSessionFor(current, plans, [current, session("ai", "p1", "pdf", 1)])?.session.id, "ai");
  });

  it("finds nothing for a first revision or an unmeasured previous plan", () => {
    assert.equal(previousSessionFor(session("first", "p1", "manual", 1), plans, []), null);
    assert.equal(previousSessionFor(current, plans, [current]), null);
  });
});

describe("matchingSheet", () => {
  it("matches by sheet code, then by page number", () => {
    const previous = [sheet({ id: "a", code: "A-02", pageNumber: 1 }), sheet({ id: "b", code: "A-01", pageNumber: 2 })];
    assert.equal(matchingSheet(sheet({ code: "A-01", pageNumber: 1 }), previous)?.id, "b");
    assert.equal(matchingSheet(sheet({ code: null, pageNumber: 1 }), previous)?.id, "a");
    assert.equal(matchingSheet(sheet({ code: "Z", pageNumber: 9 }), previous), null);
  });
});

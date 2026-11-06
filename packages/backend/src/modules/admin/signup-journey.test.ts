import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeSignupJourneys, type SignupJourneyRow } from "./signup-journey.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = new Date("2026-11-01T09:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

function row(id: string, patch: Partial<SignupJourneyRow> & { did?: Array<[string, number]>; seenAfterHours?: number }): SignupJourneyRow {
  const createdAt = patch.createdAt ?? daysAgo(20);
  const { did = [], seenAfterHours, ...rest } = patch;
  return {
    id,
    name: id,
    email: `${id}@example.test`,
    accountType: "contractor",
    country: "NG",
    emailVerified: true,
    invited: false,
    lastActivityAt: seenAfterHours === undefined ? null : new Date(createdAt.getTime() + seenAfterHours * HOUR),
    actions: did.map(([label, hours]) => ({ label, at: new Date(createdAt.getTime() + hours * HOUR) })),
    ...rest,
    createdAt,
  };
}

const cohort = [
  row("unverified", { emailVerified: false, accountType: null }),
  row("verified", {}),
  row("opened", { seenAfterHours: 0.5 }),
  row("started", { seenAfterHours: 30, did: [["Created a project", 1]], invited: true }),
  // Did work without verifying: still counts through every earlier step.
  row("worked", {
    emailVerified: false,
    seenAfterHours: 24 * 8,
    did: [["Created a project", 0.2], ["Created a task", 0.5]],
  }),
  // Got to real work, but only after the first week.
  row("slow", { seenAfterHours: 24 * 9, did: [["Created a project", 2], ["Filed a daily log", 24 * 9]] }),
  // Too new to judge for activation or coming back.
  row("fresh", { createdAt: daysAgo(2), seenAfterHours: 3, did: [["Created a task", 3]] }),
];

test("summarizeSignupJourneys places each signup at the furthest step reached", () => {
  const out = summarizeSignupJourneys(cohort, now);

  assert.equal(out.total, 7);
  assert.deepEqual(out.funnel.map((f) => f.value), [7, 6, 5, 4, 3]);
  assert.deepEqual(out.lastSeen.map((b) => b.value), [2, 1, 1, 1, 2]);
  assert.deepEqual(out.stalled.map((s) => [s.id, s.step, s.invited]), [
    ["unverified", "Signed up", false],
    ["verified", "Verified email", false],
    ["opened", "Opened the app", false],
    ["started", "Started a project or proposal", true],
  ]);
  assert.deepEqual(out.segments, [
    { group: "Account type", segment: "contractor", signups: 6, started: 4, worked: 3 },
    { group: "Account type", segment: "Not set", signups: 1, started: 0, worked: 0 },
    { group: "How they arrived", segment: "Signed up on their own", signups: 6, started: 3, worked: 3 },
    { group: "How they arrived", segment: "Invited by someone", signups: 1, started: 1, worked: 0 },
  ]);
});

test("summarizeSignupJourneys measures activation and time to value on first real work", () => {
  const out = summarizeSignupJourneys(cohort, now);

  // "fresh" is under a week old, so it is not yet eligible; "slow" missed the window.
  assert.deepEqual(out.activation, { eligible: 6, activated: 1 });
  // worked 0.5h, fresh 3h, slow 216h.
  assert.equal(out.timeToValue.medianHours, 3);
  assert.deepEqual(out.timeToValue.buckets.map((b) => b.value), [1, 1, 0, 1]);
});

test("summarizeSignupJourneys compares coming back for week-one doers against the rest", () => {
  const out = summarizeSignupJourneys(cohort, now);
  const action = (label: string) => out.actions.find((a) => a.label === label);

  // Two-week-old signups only (6). Came back after week one: worked, slow.
  assert.deepEqual(action("Created a project"), {
    label: "Created a project", users: 3, weekOne: 3, weekOneCameBack: 2, others: 3, othersCameBack: 0,
  });
  assert.deepEqual(action("Created a task"), {
    label: "Created a task", users: 2, weekOne: 1, weekOneCameBack: 1, others: 5, othersCameBack: 1,
  });
  // Done, but after week one: counts as used, not as a week-one action.
  assert.deepEqual(action("Filed a daily log"), {
    label: "Filed a daily log", users: 1, weekOne: 0, weekOneCameBack: 0, others: 6, othersCameBack: 2,
  });
});

test("summarizeSignupJourneys handles an empty cohort and caps the stalled list", () => {
  const empty = summarizeSignupJourneys([], now);
  assert.deepEqual(empty.funnel.map((f) => f.value), [0, 0, 0, 0, 0]);
  assert.equal(empty.timeToValue.medianHours, null);
  const many = Array.from({ length: 5 }, (_, i) => row(`u${i}`, {}));
  assert.deepEqual(summarizeSignupJourneys(many, now, 2).stalled.map((s) => s.id), ["u0", "u1"]);
});

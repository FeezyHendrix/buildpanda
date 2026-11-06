export const JOURNEY_STEPS = [
  "Signed up",
  "Verified email",
  "Opened the app",
  "Started a project or proposal",
  "Did real work",
] as const;

// What a user leaves behind when they use the app. `start` rows only get a
// user through the door (step 3); anything else counts as real work (step 4).
export const JOURNEY_FEATURES: ReadonlyArray<{
  label: string;
  table: string;
  column: string;
  time?: string;
  start: boolean;
}> = [
  { label: "Created a project", table: "projects", column: "owner_id", start: true },
  { label: "Joined a project", table: "project_participants", column: "user_id", start: true },
  { label: "Created a proposal", table: "proposals", column: "created_by", start: true },
  { label: "Ran a take-off", table: "takeoff_jobs", column: "requested_by", start: false },
  { label: "Created a task", table: "tasks", column: "created_by_id", start: false },
  { label: "Filed a daily log", table: "daily_logs", column: "created_by_id", start: false },
  { label: "Raised an RFI", table: "rfis", column: "created_by_id", start: false },
  { label: "Sent a message", table: "messages", column: "author_id", start: false },
  { label: "Uploaded a file", table: "uploaded_files", column: "owner_id", start: false },
  { label: "Logged a transaction", table: "project_transactions", column: "created_by_id", start: false },
  { label: "Logged a delivery", table: "material_deliveries", column: "created_by_id", start: false },
  { label: "Invited a teammate", table: "invitation", column: "inviterId", time: "createdAt", start: false },
  { label: "Invited someone to a project", table: "project_participants", column: "invited_by_id", start: false },
];

const START_FEATURES = new Set(JOURNEY_FEATURES.filter((f) => f.start).map((f) => f.label));

const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;
const LAST_SEEN_BUCKETS = ["Never opened", "Under an hour", "Under a day", "Under a week", "A week or more"] as const;
const TIME_TO_VALUE_BUCKETS = ["Within an hour", "Same day", "Within a week", "Later"] as const;

export interface SignupJourneyRow {
  id: string;
  name: string;
  email: string;
  accountType: string | null;
  country: string | null;
  emailVerified: boolean;
  createdAt: Date;
  lastActivityAt: Date | null;
  /** Someone invited this email before the account existed. */
  invited: boolean;
  /** The first time the user did each thing they have ever done. */
  actions: Array<{ label: string; at: Date }>;
}

// Furthest step reached. A later step implies the earlier ones, so the funnel
// stays monotonic even if someone did work without verifying their email.
function journeyStep(r: SignupJourneyRow): number {
  if (r.actions.some((a) => !START_FEATURES.has(a.label))) return 4;
  if (r.actions.length > 0) return 3;
  if (r.lastActivityAt) return 2;
  if (r.emailVerified) return 1;
  return 0;
}

function sinceSignup(r: SignupJourneyRow, at: Date): number {
  return at.getTime() - r.createdAt.getTime();
}

function lastSeenBucket(r: SignupJourneyRow): (typeof LAST_SEEN_BUCKETS)[number] {
  if (!r.lastActivityAt) return "Never opened";
  const ms = sinceSignup(r, r.lastActivityAt);
  if (ms < HOUR_MS) return "Under an hour";
  if (ms < 24 * HOUR_MS) return "Under a day";
  if (ms < WEEK_MS) return "Under a week";
  return "A week or more";
}

/** Milliseconds from signup to the first piece of real work, or null if none yet. */
function timeToValue(r: SignupJourneyRow): number | null {
  const times = r.actions.filter((a) => !START_FEATURES.has(a.label)).map((a) => sinceSignup(r, a.at));
  return times.length > 0 ? Math.max(0, Math.min(...times)) : null;
}

function timeToValueBucket(ms: number): (typeof TIME_TO_VALUE_BUCKETS)[number] {
  if (ms < HOUR_MS) return "Within an hour";
  if (ms < 24 * HOUR_MS) return "Same day";
  if (ms < WEEK_MS) return "Within a week";
  return "Later";
}

function tally(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

function segmentBy(rows: SignupJourneyRow[], steps: number[], group: string, key: (r: SignupJourneyRow) => string) {
  const segments = new Map<string, { group: string; segment: string; signups: number; started: number; worked: number }>();
  rows.forEach((r, i) => {
    const segment = key(r);
    const s = segments.get(segment) ?? { group, segment, signups: 0, started: 0, worked: 0 };
    s.signups += 1;
    if (steps[i]! >= 3) s.started += 1;
    if (steps[i]! >= 4) s.worked += 1;
    segments.set(segment, s);
  });
  return [...segments.values()].sort((a, b) => b.signups - a.signups);
}

/** Rows must be newest-first: the stalled list keeps the first `stalledLimit`. */
export function summarizeSignupJourneys(rows: SignupJourneyRow[], now = new Date(), stalledLimit = 300) {
  const steps = rows.map(journeyStep);
  const lastSeen = tally(rows.map(lastSeenBucket));
  const ttv = rows.map(timeToValue).filter((ms): ms is number => ms !== null).sort((a, b) => a - b);
  const ttvBuckets = tally(ttv.map(timeToValueBucket));

  // Activation is only fair to judge once a signup has had its full first week.
  const weekOld = rows.filter((r) => sinceSignup(r, now) >= WEEK_MS);
  const activated = weekOld.filter((r) => {
    const ms = timeToValue(r);
    return ms !== null && ms < WEEK_MS;
  });

  // "Came back" = seen again after the first week, so judge it only on signups
  // old enough to have had a second week to return in.
  const twoWeeksOld = rows.filter((r) => sinceSignup(r, now) >= 2 * WEEK_MS);
  const cameBack = (r: SignupJourneyRow) => r.lastActivityAt !== null && sinceSignup(r, r.lastActivityAt) >= WEEK_MS;
  const actions = JOURNEY_FEATURES.map((f) => {
    const inWeekOne = (r: SignupJourneyRow) =>
      r.actions.some((a) => a.label === f.label && sinceSignup(r, a.at) < WEEK_MS);
    const did = twoWeeksOld.filter(inWeekOne);
    const others = twoWeeksOld.filter((r) => !inWeekOne(r));
    return {
      label: f.label,
      users: rows.filter((r) => r.actions.some((a) => a.label === f.label)).length,
      weekOne: did.length,
      weekOneCameBack: did.filter(cameBack).length,
      others: others.length,
      othersCameBack: others.filter(cameBack).length,
    };
  }).sort((a, b) => b.users - a.users);

  return {
    total: rows.length,
    funnel: JOURNEY_STEPS.map((step, i) => ({ step, value: steps.filter((s) => s >= i).length })),
    lastSeen: LAST_SEEN_BUCKETS.map((label) => ({ label, value: lastSeen.get(label) ?? 0 })),
    activation: { eligible: weekOld.length, activated: activated.length },
    timeToValue: {
      // Upper median: with few users it reports a time someone actually took.
      medianHours: ttv.length > 0 ? ttv[Math.floor(ttv.length / 2)]! / HOUR_MS : null,
      buckets: TIME_TO_VALUE_BUCKETS.map((label) => ({ label, value: ttvBuckets.get(label) ?? 0 })),
    },
    actions,
    segments: [
      ...segmentBy(rows, steps, "Account type", (r) => r.accountType ?? "Not set"),
      ...segmentBy(rows, steps, "How they arrived", (r) => (r.invited ? "Invited by someone" : "Signed up on their own")),
    ],
    stalled: rows
      .flatMap((r, i) =>
        steps[i]! < 4
          ? [
              {
                id: r.id,
                name: r.name,
                email: r.email,
                accountType: r.accountType,
                country: r.country,
                invited: r.invited,
                createdAt: r.createdAt,
                lastActivityAt: r.lastActivityAt,
                step: JOURNEY_STEPS[steps[i]!],
              },
            ]
          : [],
      )
      .slice(0, stalledLimit),
  };
}

import type { Knex } from "knex";

/**
 * Site-record demo data for the Sample Project: the narrative half of the daily
 * log (free-text entries and the void that retracts one), the issued period
 * reports, the two-week look-aheads, and the programme's delay audit trail.
 *
 * Runs after 20260530_marbella.ts and 20260775_marbella_modern.ts, which own
 * `projects`, `activities`, `activity_delays`, `daily_logs` and
 * `daily_log_activities`. Everything here hangs off ids those seeds created.
 */

const PROJECT_ID = "sample-project";
const BUILDING_ID = `bld_${PROJECT_ID}`;

/** Marbella's site days. Entries can only attach to a daily_logs row that exists. */
const LOG_15 = "2026-04-15";
const LOG_17 = "2026-04-17";
const LOG_23 = "2026-04-23";

function iso(date: string, time = "16:30:00"): string {
  return new Date(`${date}T${time}Z`).toISOString();
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function dateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The lookup register every activity_delays row points at (ON DELETE RESTRICT). */
const DELAY_REASON_FALLBACK: ReadonlyArray<Record<string, unknown>> = [
  { code: "WEATHER_RAIN", category: "Weather", name: "Rain", description: "Heavy rainfall blocked work", default_culpability: "neutral", default_eot_claimable: true },
  { code: "MATERIAL_DELIVERY", category: "Material", name: "Delivery Delay", description: "Material delivery arrived late or not at all", default_culpability: "contractor", default_eot_claimable: false },
  { code: "APPROVAL_INSPECTION", category: "Approval", name: "Inspection Hold", description: "Awaiting inspector sign-off", default_culpability: "client", default_eot_claimable: true },
  { code: "LABOR_NOSHOW", category: "Labor", name: "Worker No-Show", description: "Crew did not report to site", default_culpability: "contractor", default_eot_claimable: false },
  { code: "OTHER", category: "Other", name: "Other", description: "Cause not otherwise classified", default_culpability: "neutral", default_eot_claimable: false },
];

interface EntrySpec {
  id: string;
  logDate: string;
  authorName: string;
  authorRole: string;
  text: string;
  at: string;
}

/**
 * What a Lagos site agent actually writes up at close of play: crew, plant,
 * deliveries, statutory visits and the weather that stopped work. The
 * narrative is deliberately richer than the numeric log so the daily-log page
 * has something to read as well as count.
 */
const ENTRIES: readonly EntrySpec[] = [
  {
    id: "dle_seed_0415_pour",
    logDate: LOG_15,
    authorName: "Site Manager",
    authorRole: "PM",
    text: "Columns C1–C4 on Block A Floor 2 poured from 08:20. Two cube sets (6 cubes) taken per pour and tagged for 7 and 28 day crushing at the Ikeja lab. Full crew of 12 on site, no lost-time incidents.",
    at: iso(LOG_15, "17:10:00"),
  },
  {
    id: "dle_seed_0415_plant",
    logDate: LOG_15,
    authorName: "Store Keeper",
    authorRole: "Employee",
    text: "80kVA generator run 06:00–18:00 on site diesel; 140 litres drawn. Vibrator poker serviced at lunch break.",
    at: iso(LOG_15, "18:05:00"),
  },
  {
    id: "dle_seed_0417_rain",
    logDate: LOG_17,
    authorName: "Site Manager",
    authorRole: "PM",
    text: "Rain from 13:05 to close. Form-stripping on C5–C8 stood down and the crew rotated to rebar prep under the slab soffit. 18.5mm recorded in the site gauge. Delay raised against the column placement package.",
    at: iso(LOG_17, "17:40:00"),
  },
  {
    id: "dle_seed_0417_eng",
    logDate: LOG_17,
    authorName: "Engr. David Okonjo",
    authorRole: "Engineer",
    text: "Walked the stripped faces on C1–C4 before the rain. Honeycombing at the base of C3 is cosmetic, depth under 10mm — to be made good with a non-shrink repair mortar, not a structural concern. Cover meter check passed at 40mm.",
    at: iso(LOG_17, "14:20:00"),
  },
  {
    id: "dle_seed_0423_pump",
    logDate: LOG_23,
    authorName: "Site Manager",
    authorRole: "PM",
    text: "Slab pour on Floor 2 started 09:00 once the trailer pump arrived from Ojota — two hours behind the booked window. 68m3 placed by 16:30, power float started on the east bay. Steel placement signed off by the RE before the pour.",
    at: iso(LOG_23, "17:55:00"),
  },
  {
    id: "dle_seed_0423_void",
    logDate: LOG_23,
    authorName: "Store Keeper",
    authorRole: "Employee",
    text: "Received 12 tonnes of 16mm reinforcement from Lagos Steel Mills, waybill LSM-44812.",
    at: iso(LOG_23, "11:15:00"),
  },
];

/**
 * A daily log is a contractual record, so a wrong entry is retracted with a
 * reason and an author, never deleted. This one recorded a delivery on the day
 * the waybill was raised rather than the day the truck tipped on site.
 */
const VOIDS: ReadonlyArray<Record<string, unknown>> = [
  {
    id: "dlev_seed_0423_steel",
    entry_id: "dle_seed_0423_void",
    reason: "Waybill LSM-44812 was raised on the 23rd but the truck only tipped on site on the 24th. Re-entered against the correct date so the material ledger and the log agree.",
    voided_by_id: null,
    voided_by_name: "Site Manager",
    voided_at: iso(LOG_23, "19:30:00"),
  },
];

async function seedEntries(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("daily_log_entries"))) return;

  await knex("daily_log_entry_voids").where("id", "like", "dlev_seed_%").del();
  await knex("daily_log_entries").where({ project_id: PROJECT_ID }).andWhere("id", "like", "dle_seed_%").del();

  // The composite FK (project_id, building_id, log_date) means an entry cannot
  // exist without its numeric log. Only write against days the Marbella seed made.
  const days = await knex("daily_logs")
    .where({ project_id: PROJECT_ID, building_id: BUILDING_ID })
    .pluck<Array<string | Date>>("log_date");
  // connection.ts parses pg `date` as a raw string, but a Date can still reach
  // here through a different pool, so normalise both shapes to YYYY-MM-DD.
  const present = new Set(
    days.map((day) => (typeof day === "string" ? day : day.toISOString()).slice(0, 10)),
  );
  const usable = ENTRIES.filter((entry) => present.has(entry.logDate));
  if (usable.length === 0) return;

  await knex("daily_log_entries").insert(
    usable.map((entry) => ({
      id: entry.id,
      project_id: PROJECT_ID,
      building_id: BUILDING_ID,
      log_date: entry.logDate,
      author_id: null,
      author_name: entry.authorName,
      author_role: entry.authorRole,
      body_html: `<p>${entry.text}</p>`,
      body_text: entry.text,
      created_at: entry.at,
      updated_at: entry.at,
    })),
  );

  if (!(await knex.schema.hasTable("daily_log_entry_voids"))) return;
  const written = new Set(usable.map((entry) => entry.id));
  const voids = VOIDS.filter((row) => written.has(String(row.entry_id)));
  if (voids.length > 0) await knex("daily_log_entry_voids").insert(voids);
}

/**
 * Each row is a document that left the site office. The snapshot is the figures
 * the issued .docx carried, so a later void cannot silently rewrite history.
 * Dated against the April site days rather than "now" — a weekly report is
 * meaningless outside the fortnight it reports on.
 */
const REPORTS: ReadonlyArray<Record<string, unknown>> = [
  {
    id: "dlrep_seed_w16",
    project_id: PROJECT_ID,
    period: "weekly",
    range_from: "2026-04-13",
    range_to: "2026-04-19",
    file_name: "weekly-report-sample-project-2026-04-13-to-2026-04-19.docx",
    snapshot: JSON.stringify({ daysLogged: 2, totalDaysInPeriod: 7, totalHours: 156, avgCrew: 11, narrativeEntries: 4, voidedEntries: 0 }),
    generated_by_id: null,
    generated_by_name: "Site Manager",
    generated_at: iso("2026-04-20", "08:15:00"),
  },
  {
    id: "dlrep_seed_w17",
    project_id: PROJECT_ID,
    period: "weekly",
    range_from: "2026-04-20",
    range_to: "2026-04-26",
    file_name: "weekly-report-sample-project-2026-04-20-to-2026-04-26.docx",
    snapshot: JSON.stringify({ daysLogged: 1, totalDaysInPeriod: 7, totalHours: 112, avgCrew: 16, narrativeEntries: 2, voidedEntries: 1 }),
    generated_by_id: null,
    generated_by_name: "Site Manager",
    generated_at: iso("2026-04-27", "08:40:00"),
  },
  {
    id: "dlrep_seed_m04",
    project_id: PROJECT_ID,
    period: "monthly",
    range_from: "2026-04-01",
    range_to: "2026-04-30",
    file_name: "monthly-report-sample-project-2026-04-01-to-2026-04-30.docx",
    snapshot: JSON.stringify({ daysLogged: 3, totalDaysInPeriod: 30, totalHours: 268, avgCrew: 12.7, narrativeEntries: 6, voidedEntries: 1 }),
    generated_by_id: null,
    generated_by_name: "Engr. David Okonjo",
    generated_at: iso("2026-05-04", "09:05:00"),
  },
];

async function seedReports(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("daily_log_reports"))) return;
  await knex("daily_log_reports").where({ project_id: PROJECT_ID }).andWhere("id", "like", "dlrep_seed_%").del();
  await knex("daily_log_reports").insert(REPORTS);
}

interface LookAheadSpec {
  id: string;
  name: string;
  description: string;
  status: string;
  startOffset: number;
  endOffset: number;
  totalWorkers: number;
  approvedByName: string | null;
  approvedDaysAgo: number | null;
  approvalNote: string | null;
  activityIds: readonly string[];
}

/**
 * Two-week windows, dated relative to today so the programme page always has a
 * live one. Approval is a sign-off: only the window that has actually been
 * walked through in a progress meeting carries an approver and a time.
 */
const LOOK_AHEADS: readonly LookAheadSpec[] = [
  {
    id: "la_seed_prev",
    name: "Two-week look-ahead — W/C previous fortnight",
    description: "Column placement completion and slab preparation on Block A Floor 2. Rebar fixing crew doubled to recover the rain days.",
    status: "Approved",
    startOffset: -17,
    endOffset: -4,
    totalWorkers: 24,
    approvedByName: "Engr. David Okonjo",
    approvedDaysAgo: 18,
    approvalNote: "Agreed at the Monday progress meeting. Rebar crew uplift approved on the condition the pump booking is confirmed 48h ahead.",
    activityIds: ["act-1", "act-2"],
  },
  {
    id: "la_seed_current",
    name: "Two-week look-ahead — current fortnight",
    description: "Floor 2 slab curing and strike, blockwork setting out to the east elevation, and roofing sheet delivery staging on the north access pad.",
    status: "Approved",
    startOffset: -3,
    endOffset: 10,
    totalWorkers: 28,
    approvedByName: "Engr. David Okonjo",
    approvedDaysAgo: 4,
    approvalNote: "Approved subject to the 50-ton crane being confirmed before sheets land on site.",
    activityIds: ["act-2", "act-3"],
  },
  {
    id: "la_seed_next",
    name: "Two-week look-ahead — next fortnight",
    description: "Roof truss lift and long-span sheeting to Block A, first-fix conduit drops behind the east blockwork. Draft pending the crane confirmation.",
    status: "Draft",
    startOffset: 11,
    endOffset: 24,
    totalWorkers: 22,
    approvedByName: null,
    approvedDaysAgo: null,
    approvalNote: null,
    activityIds: ["act-3"],
  },
];

async function seedLookAheads(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("look_aheads"))) return;

  // look_ahead_activities cascades, but clearing it first keeps a partial
  // re-run from leaving orphan links if the parent delete is ever narrowed.
  const mine = await knex("look_aheads")
    .where({ project_id: PROJECT_ID })
    .andWhere("id", "like", "la_seed_%")
    .pluck<string[]>("id");
  if (mine.length > 0) {
    await knex("look_ahead_activities").whereIn("look_ahead_id", mine).del();
    await knex("look_aheads").whereIn("id", mine).del();
  }

  const hasApproval = await knex.schema.hasColumn("look_aheads", "approved_at");

  await knex("look_aheads").insert(
    LOOK_AHEADS.map((la) => ({
      id: la.id,
      project_id: PROJECT_ID,
      building_id: BUILDING_ID,
      name: la.name,
      description: la.description,
      status: la.status,
      start_date: dateDaysFromNow(la.startOffset),
      end_date: dateDaysFromNow(la.endOffset),
      total_workers: la.totalWorkers,
      created_by_id: null,
      created_at: isoDaysAgo(Math.max(1, -la.startOffset + 2)),
      updated_at: isoDaysAgo(1),
      ...(hasApproval
        ? {
            approved_by_id: null,
            approved_by_name: la.approvedByName,
            approved_at: la.approvedDaysAgo === null ? null : isoDaysAgo(la.approvedDaysAgo),
            approval_note: la.approvalNote,
          }
        : {}),
    })),
  );

  if (!(await knex.schema.hasTable("look_ahead_activities"))) return;
  const existing = new Set(
    await knex("activities").where({ project_id: PROJECT_ID }).pluck<string[]>("id"),
  );
  const links = LOOK_AHEADS.flatMap((la) =>
    la.activityIds.filter((id) => existing.has(id)).map((activityId) => ({
      look_ahead_id: la.id,
      activity_id: activityId,
    })),
  );
  if (links.length > 0) await knex("look_ahead_activities").insert(links);
}

/**
 * The cascade's ledger. `days_delta` is working days the programme actually
 * moved by, which is what a loss-and-expense or EOT argument is built from —
 * the rain event moved the successor slab pour, the late pump did not.
 * `delay_id` cites the Marbella seed's activity_delays rows (ad-1 rain, ad-2 pump).
 */
const RAIN_SUMMARY = "Rain delay on Column placement — Block A, Floor 2: 1 working day(s) lost";
const EVENTS: ReadonlyArray<{ id: string; activityId: string; summary: string; delta: number; delayId: string; daysAgo: number }> = [
  { id: "aev_seed_rain_1", activityId: "act-1", summary: RAIN_SUMMARY, delta: 1, delayId: "ad-1", daysAgo: 159 },
  { id: "aev_seed_rain_2", activityId: "act-2", summary: RAIN_SUMMARY, delta: 1, delayId: "ad-1", daysAgo: 159 },
  { id: "aev_seed_rain_3", activityId: "act-3", summary: RAIN_SUMMARY, delta: 1, delayId: "ad-1", daysAgo: 159 },
  // Recovered inside the same shift, so the pump delay costs money but no days.
  { id: "aev_seed_pump_1", activityId: "act-2", summary: "Delay on Slab pour — Floor 2 re-measured to 0 working day(s)", delta: 0, delayId: "ad-2", daysAgo: 152 },
];

async function seedActivityEvents(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("activity_events"))) return;
  await knex("activity_events").where({ project_id: PROJECT_ID }).andWhere("id", "like", "aev_seed_%").del();

  const existing = new Set(
    await knex("activities").where({ project_id: PROJECT_ID }).pluck<string[]>("id"),
  );
  const rows = EVENTS.filter((event) => existing.has(event.activityId)).map((event) => ({
    id: event.id,
    project_id: PROJECT_ID,
    activity_id: event.activityId,
    kind: "delay_shift",
    summary: event.summary,
    days_delta: event.delta,
    delay_id: event.delayId,
    actor_id: null,
    created_at: isoDaysAgo(event.daysAgo),
  }));
  if (rows.length > 0) await knex("activity_events").insert(rows);
}

/**
 * The register is global, not project-scoped, and activity_delays points at it
 * with ON DELETE RESTRICT — so a seed must never clear it. Migrations 20260602
 * and 20260915 populate it; this only backfills a DB where it came up empty.
 */
async function ensureDelayReasons(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("delay_reasons"))) return;
  const [row] = await knex("delay_reasons").count<Array<{ count: string }>>("code as count");
  if (Number(row?.count ?? 0) > 0) return;

  const hasCulpability = await knex.schema.hasColumn("delay_reasons", "default_culpability");
  await knex("delay_reasons")
    .insert(
      DELAY_REASON_FALLBACK.map((reason) => {
        if (hasCulpability) return reason;
        const { default_culpability: _c, default_eot_claimable: _e, ...base } = reason;
        return base;
      }),
    )
    .onConflict("code")
    .ignore();
}

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first();
  if (!project) return;

  await ensureDelayReasons(knex);
  await seedEntries(knex);
  await seedReports(knex);
  await seedLookAheads(knex);
  await seedActivityEvents(knex);
}

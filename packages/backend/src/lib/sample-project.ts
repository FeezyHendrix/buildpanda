import type { Knex } from "knex";
import { generateId } from "./ids.ts";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function weeksFromNow(weeks: number): Date {
  return new Date(Date.now() + weeks * WEEK_MS);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthRange(start: Date, end: Date): string {
  return `${MONTHS[start.getMonth()]} – ${MONTHS[end.getMonth()]}`;
}

/**
 * Gives a brand-new organization a small, believable starter project so the
 * first thing a company sees is a working workspace rather than empty states.
 * Every row is a normal record in their org — explorable, editable and
 * deletable like any real project. Dates are computed relative to now so the
 * sample never looks stale.
 */
export async function provisionSampleProject(db: Knex, organizationId: string): Promise<void> {
  const projectId = generateId("prj");
  const buildingId = generateId("bld");
  const now = new Date();

  const phaseStarts = [-10, -6, 2, 10, 18].map(weeksFromNow);
  const phaseEnds = [-6, 4, 10, 18, 24].map(weeksFromNow);
  const phaseIds = phaseStarts.map(() => generateId("ph"));

  await db.transaction(async (trx) => {
    await trx("projects").insert({
      id: projectId,
      owner_id: null,
      organization_id: organizationId,
      name: "Sample Project — 4-Bedroom Duplex",
      address: "Plot 14, Orchid Road, Lekki, Lagos",
      status: "On Track",
      health_score: 88,
      risk: "Low",
      progress_percent: 34,
      budget_total: 85_000_000,
      budget_used: 28_900_000,
      currency: "NGN",
      pending_approvals: 0,
      next_inspection_type: "Structural Integrity",
      next_inspection_date: `${MONTHS[weeksFromNow(2).getMonth()]} ${weeksFromNow(2).getDate()}`,
      folder_tone: "brand",
      updated_at: now.toISOString(),
    });

    await trx("buildings").insert([
      {
        id: buildingId,
        project_id: projectId,
        name: "Main Duplex",
        kind: "real",
        status: "active",
        sort_order: 0,
        progress_percent: 34,
      },
      {
        id: generateId("bld"),
        project_id: projectId,
        name: "Shared",
        kind: "shared",
        status: "active",
        sort_order: -1,
        progress_percent: 0,
      },
    ]);

    const phaseNames = ["Foundation", "Structural Shell", "Roofing & MEP", "Interior Finishes", "Handover"];
    const phaseStatus = ["Done", "InProgress", "Pending", "Pending", "Pending"];
    const phaseProgress = [100, 55, 0, 0, 0];
    await trx("project_phases").insert(
      phaseNames.map((name, index) => ({
        id: phaseIds[index],
        project_id: projectId,
        building_id: buildingId,
        name,
        status: phaseStatus[index],
        date_range: monthRange(phaseStarts[index]!, phaseEnds[index]!),
        start_date: isoDate(phaseStarts[index]!),
        end_date: isoDate(phaseEnds[index]!),
        progress_percent: phaseProgress[index],
        sort_order: index,
      })),
    );

    await trx("key_dates").insert([
      {
        id: generateId("kd"),
        project_id: projectId,
        building_id: buildingId,
        label: "Foundation complete",
        target_date: isoDate(weeksFromNow(-6)),
        actual_date: isoDate(weeksFromNow(-6)),
        status: "Met",
        notes: null,
        sort_order: 0,
      },
      {
        id: generateId("kd"),
        project_id: projectId,
        building_id: buildingId,
        label: "Roof on (weathertight)",
        target_date: isoDate(weeksFromNow(9)),
        actual_date: null,
        status: "Upcoming",
        notes: null,
        sort_order: 1,
      },
      {
        id: generateId("kd"),
        project_id: projectId,
        building_id: buildingId,
        label: "Handover",
        target_date: isoDate(weeksFromNow(24)),
        actual_date: null,
        status: "Upcoming",
        notes: "Sample milestone — replace with your own.",
        sort_order: 2,
      },
    ]);

    await trx("activities").insert([
      {
        id: generateId("act"),
        project_id: projectId,
        building_id: buildingId,
        phase_id: phaseIds[1],
        name: "Ground floor blockwork",
        activity_type: "concrete_pour",
        location: "Ground floor",
        status: "Completed",
        planned_start_at: weeksFromNow(-4).toISOString(),
        planned_end_at: weeksFromNow(-3).toISOString(),
        actual_start_at: weeksFromNow(-4).toISOString(),
        actual_end_at: weeksFromNow(-3).toISOString(),
        worker_count_planned: 10,
        notes: "9-inch sandcrete blocks to first-floor level.",
      },
      {
        id: generateId("act"),
        project_id: projectId,
        building_id: buildingId,
        phase_id: phaseIds[1],
        name: "First floor slab pour",
        activity_type: "concrete_pour",
        location: "First floor",
        status: "InProgress",
        planned_start_at: weeksFromNow(-1).toISOString(),
        planned_end_at: weeksFromNow(1).toISOString(),
        actual_start_at: weeksFromNow(-1).toISOString(),
        actual_end_at: null,
        worker_count_planned: 14,
        notes: null,
      },
      {
        id: generateId("act"),
        project_id: projectId,
        building_id: buildingId,
        phase_id: phaseIds[2],
        name: "Roof truss installation",
        activity_type: "roofing",
        location: "Roof level",
        status: "Planned",
        planned_start_at: weeksFromNow(3).toISOString(),
        planned_end_at: weeksFromNow(5).toISOString(),
        actual_start_at: null,
        actual_end_at: null,
        worker_count_planned: 8,
        notes: null,
      },
    ]);

    await trx("daily_logs").insert([
      {
        project_id: projectId,
        building_id: buildingId,
        log_date: isoDate(weeksFromNow(-1)),
        weather_condition: "Sunny",
        temperature_c: 31,
        precipitation_mm: 0,
        wind_kph: 10,
        workers_expected: 14,
        workers_present: 13,
        total_hours: 104,
        summary: "Slab formwork completed and rebar laid. Pour scheduled next.",
      },
      {
        project_id: projectId,
        building_id: buildingId,
        log_date: isoDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
        weather_condition: "Cloudy",
        temperature_c: 29,
        precipitation_mm: 2,
        wind_kph: 14,
        workers_expected: 14,
        workers_present: 14,
        total_hours: 112,
        summary: "First bay of the slab poured and vibrated. No incidents.",
      },
    ]);
  });
}

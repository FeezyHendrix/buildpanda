import type { Knex } from "knex";

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface ActivityDateRow {
  phase_id: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
}

interface PhaseSpan {
  start: string | null;
  end: string | null;
}

export async function recomputePhaseDateRanges(db: Knex, projectId: string): Promise<void> {
  const activities = await db<ActivityDateRow>("activities")
    .where({ project_id: projectId })
    .whereNotNull("phase_id")
    .select("phase_id", "planned_start_at", "planned_end_at");

  const spans = new Map<string, PhaseSpan>();
  for (const a of activities) {
    if (!a.phase_id) continue;
    const span = spans.get(a.phase_id) ?? { start: null, end: null };
    if (a.planned_start_at && (!span.start || a.planned_start_at < span.start)) {
      span.start = a.planned_start_at;
    }
    if (a.planned_end_at && (!span.end || a.planned_end_at > span.end)) {
      span.end = a.planned_end_at;
    }
    spans.set(a.phase_id, span);
  }

  for (const [phaseId, span] of spans) {
    const range =
      span.start && span.end ? `${formatShort(span.start)} – ${formatShort(span.end)}` : "";
    if (range) {
      await db("project_phases").where({ id: phaseId, project_id: projectId }).update({ date_range: range });
    }
  }
}

interface ActivityProgressRow {
  phase_id: string | null;
  status: string;
}

function percentDone(rows: { status: string }[]): number {
  if (rows.length === 0) return 0;
  const done = rows.filter((r) => r.status === "Completed").length;
  return Math.round((done / rows.length) * 100);
}

export async function recomputeProgress(db: Knex, projectId: string): Promise<void> {
  const activities = await db<ActivityProgressRow>("activities")
    .where({ project_id: projectId })
    .whereNot("status", "Cancelled")
    .select("phase_id", "status");

  await db("projects")
    .where({ id: projectId })
    .update({ progress_percent: percentDone(activities), updated_at: new Date().toISOString() });

  const byPhase = new Map<string, { status: string }[]>();
  for (const a of activities) {
    if (!a.phase_id) continue;
    const list = byPhase.get(a.phase_id) ?? [];
    list.push({ status: a.status });
    byPhase.set(a.phase_id, list);
  }

  for (const [phaseId, rows] of byPhase) {
    const pct = percentDone(rows);
    const status = pct >= 100 ? "Done" : pct > 0 ? "InProgress" : "Pending";
    await db("project_phases")
      .where({ id: phaseId, project_id: projectId })
      .update({ progress_percent: pct, status });
  }
}

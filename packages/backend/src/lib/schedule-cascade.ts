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

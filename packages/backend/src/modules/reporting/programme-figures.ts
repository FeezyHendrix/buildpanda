import type { Knex } from "knex";

export interface ProgrammeFigures {
  /** Plain work rows: summaries and milestones are not work items. */
  workItems: { total: number; completed: number; remaining: number };
  /** Non-voided daily logs dated today in the project's timezone. */
  dailyLogsToday: number;
}

/** The programme page's stat cards, from the same tables the chart draws. */
export async function programmeFigures(db: Knex, projectId: string, today: string): Promise<ProgrammeFigures> {
  const [items, logs] = await Promise.all([
    db("activities")
      .where({ project_id: projectId, is_milestone: false })
      .whereNot("activity_type", "Summary")
      .first<{ total: string; completed: string }>(
        db.raw("count(*) as total"),
        db.raw("count(*) FILTER (WHERE status = 'Completed') as completed"),
      ),
    db("daily_logs")
      .where({ project_id: projectId, log_date: today })
      .whereNull("voided_at")
      .count<{ count: string }[]>("* as count"),
  ]);
  const total = Number(items?.total ?? 0);
  const completed = Number(items?.completed ?? 0);
  return { workItems: { total, completed, remaining: Math.max(0, total - completed) }, dailyLogsToday: Number(logs[0]?.count ?? 0) };
}

export function timelineShiftStatus(shiftDays: number): "on_schedule" | "behind" | "ahead" {
  return shiftDays > 0 ? "behind" : shiftDays < 0 ? "ahead" : "on_schedule";
}

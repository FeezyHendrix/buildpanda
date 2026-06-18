import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { toIso } from "../../lib/dates.ts";
import type { DailyLogsRepository } from "./repository.ts";
import type {
  DailyLog,
  DailyLogActivityLink,
  DailyLogActivityRow,
  DailyLogRow,
  LinkActivityInput,
  UpsertDailyLogInput,
} from "./types.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string, field: string): void {
  if (!DATE_RE.test(value)) {
    throw new BadRequestError(`${field} must be ISO date YYYY-MM-DD`);
  }
}

function numOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function toLogDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function buildLog(row: DailyLogRow, activities: DailyLogActivityLink[]): DailyLog {
  return {
    projectId: row.project_id,
    logDate: toLogDateString(row.log_date),
    weatherCondition: row.weather_condition,
    temperatureC: numOrNull(row.temperature_c),
    precipitationMm: numOrNull(row.precipitation_mm),
    windKph: numOrNull(row.wind_kph),
    workersExpected: row.workers_expected,
    workersPresent: row.workers_present,
    totalHours: Number(row.total_hours),
    summary: row.summary,
    activities,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface DailyLogActivityHooks {
  createUpdate?: (
    projectId: string,
    input: { category: "Progress"; title: string; description: string; activityId: string },
    actor: { id: string; name: string },
  ) => Promise<unknown>;
  markActivityInProgress?: (projectId: string, activityId: string) => Promise<void>;
}

export function dailyLogsService(
  repository: DailyLogsRepository,
  hooks: DailyLogActivityHooks = {},
) {
  async function attachActivities(rows: DailyLogRow[]): Promise<DailyLog[]> {
    if (rows.length === 0) return [];
    const keys = rows.map((r) => ({
      projectId: r.project_id,
      logDate: toLogDateString(r.log_date),
    }));
    const links = await repository.activitiesFor(keys);
    const activityIds = Array.from(new Set(links.map((l) => l.activity_id)));
    const nameRows = await repository.activityNamesByIds(activityIds);
    const names = new Map(nameRows.map((n) => [n.id, n.name]));

    const linkMap = new Map<string, DailyLogActivityLink[]>();
    for (const link of links) {
      const key = `${link.project_id}|${toLogDateString(link.log_date)}`;
      const list = linkMap.get(key) ?? [];
      list.push({
        activityId: link.activity_id,
        activityName: names.get(link.activity_id) ?? link.activity_id,
        hoursLogged: Number(link.hours_logged),
      });
      linkMap.set(key, list);
    }

    return rows.map((row) =>
      buildLog(row, linkMap.get(`${row.project_id}|${toLogDateString(row.log_date)}`) ?? []),
    );
  }

  return {
    async listByProject(
      projectId: string,
      from?: string,
      to?: string,
    ): Promise<DailyLog[]> {
      if (from) assertDate(from, "from");
      if (to) assertDate(to, "to");
      const rows = await repository.listByProjectInRange(projectId, from, to);
      return attachActivities(rows);
    },

    async getOne(projectId: string, logDate: string): Promise<DailyLog> {
      assertDate(logDate, "logDate");
      const row = await repository.findOne({ projectId, logDate });
      if (!row) throw new NotFoundError("Daily log");
      const [withActivities] = await attachActivities([row]);
      if (!withActivities) throw new NotFoundError("Daily log");
      return withActivities;
    },

    async upsert(
      projectId: string,
      logDate: string,
      input: UpsertDailyLogInput,
      actorId: string,
    ): Promise<DailyLog> {
      assertDate(logDate, "logDate");
      await repository.upsert({ projectId, logDate }, input, actorId);
      return this.getOne(projectId, logDate);
    },

    async linkActivity(
      projectId: string,
      logDate: string,
      input: LinkActivityInput,
      actor?: { id: string; name: string },
    ): Promise<DailyLogActivityRow> {
      assertDate(logDate, "logDate");
      const activity = await repository.findActivity(projectId, input.activityId);
      if (!activity) throw new BadRequestError("activityId does not belong to this project");

      const existing = await repository.findOne({ projectId, logDate });
      if (!existing) throw new NotFoundError("Daily log");

      const link = await repository.upsertActivityLink(
        { projectId, logDate },
        input.activityId,
        input.hoursLogged,
      );

      if (hooks.markActivityInProgress) {
        await hooks.markActivityInProgress(projectId, input.activityId).catch(() => undefined);
      }
      if (hooks.createUpdate && actor) {
        const activityName = activity.name ?? "an activity";
        await hooks
          .createUpdate(
            projectId,
            {
              category: "Progress",
              title: `Site work logged on ${activityName}`,
              description: `${input.hoursLogged} hour(s) logged against ${activityName} on ${logDate}.`,
              activityId: input.activityId,
            },
            actor,
          )
          .catch(() => undefined);
      }

      return link;
    },

    async remove(projectId: string, logDate: string): Promise<void> {
      assertDate(logDate, "logDate");
      const existing = await repository.findOne({ projectId, logDate });
      if (!existing) throw new NotFoundError("Daily log");
      await repository.deleteOne({ projectId, logDate });
    },
  };
}

export type DailyLogsService = ReturnType<typeof dailyLogsService>;

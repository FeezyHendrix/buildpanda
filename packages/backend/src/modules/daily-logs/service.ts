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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function numOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function toLogDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function buildLog(
  row: DailyLogRow,
  activities: DailyLogActivityLink[],
  voiderNames: Map<string, string>,
): DailyLog {
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
    voidedAt: row.voided_at ? toIso(row.voided_at) : null,
    voidedById: row.voided_by_id,
    voidedByName: row.voided_by_id ? (voiderNames.get(row.voided_by_id) ?? null) : null,
    voidReason: row.void_reason,
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

    const voiderIds = rows.map((r) => r.voided_by_id).filter((id): id is string => Boolean(id));
    const voiderRows = await repository.voidersByIds(voiderIds);
    const voiderNames = new Map(voiderRows.map((v) => [v.id, v.name]));

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
      buildLog(row, linkMap.get(`${row.project_id}|${toLogDateString(row.log_date)}`) ?? [], voiderNames),
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
      const current = await repository.findOne({ projectId, logDate });
      if (current?.voided_at) throw new BadRequestError("A voided daily log cannot be edited");
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

    async voidLog(
      projectId: string,
      logDate: string,
      reason: string,
      actorId: string | null,
    ): Promise<DailyLog> {
      assertDate(logDate, "logDate");
      const trimmed = reason.trim();
      if (trimmed === "" || stripHtml(trimmed) === "") {
        throw new BadRequestError("A reason is required to void a daily log");
      }
      const existing = await repository.findOne({ projectId, logDate });
      if (!existing) throw new NotFoundError("Daily log");
      if (existing.voided_at) throw new BadRequestError("This daily log has already been voided");
      await repository.voidOne({ projectId, logDate }, trimmed, actorId);
      const [voided] = await attachActivities([
        { ...existing, voided_at: new Date(), voided_by_id: actorId, void_reason: trimmed },
      ]);
      if (!voided) throw new NotFoundError("Daily log");
      return voided;
    },
  };
}

export type DailyLogsService = ReturnType<typeof dailyLogsService>;

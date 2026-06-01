import type { Knex } from "knex";
import type {
  DailyLogActivityRow,
  DailyLogRow,
  UpsertDailyLogInput,
  WeatherCondition,
} from "./types.ts";

export interface DailyLogKey {
  projectId: string;
  logDate: string;
}

function toRowPatch(input: UpsertDailyLogInput): Partial<DailyLogRow> {
  const patch: Partial<DailyLogRow> = {};
  const set = <K extends keyof DailyLogRow>(key: K, value: DailyLogRow[K]): void => {
    patch[key] = value;
  };
  if (input.weatherCondition !== undefined) {
    set("weather_condition", input.weatherCondition as WeatherCondition | null);
  }
  if (input.temperatureC !== undefined) {
    set("temperature_c", input.temperatureC === null ? null : String(input.temperatureC));
  }
  if (input.precipitationMm !== undefined) {
    set("precipitation_mm", input.precipitationMm === null ? null : String(input.precipitationMm));
  }
  if (input.windKph !== undefined) {
    set("wind_kph", input.windKph === null ? null : String(input.windKph));
  }
  if (input.workersExpected !== undefined) set("workers_expected", input.workersExpected);
  if (input.workersPresent !== undefined) set("workers_present", input.workersPresent);
  if (input.totalHours !== undefined) set("total_hours", String(input.totalHours));
  if (input.summary !== undefined) set("summary", input.summary);
  return patch;
}

export function dailyLogsRepository(db: Knex) {
  return {
    listByProjectInRange(
      projectId: string,
      from: string | undefined,
      to: string | undefined,
    ): Promise<DailyLogRow[]> {
      let query = db<DailyLogRow>("daily_logs")
        .where({ project_id: projectId })
        .orderBy("log_date", "desc");
      if (from) query = query.andWhere("log_date", ">=", from);
      if (to) query = query.andWhere("log_date", "<=", to);
      return query;
    },

    findOne(key: DailyLogKey): Promise<DailyLogRow | undefined> {
      return db<DailyLogRow>("daily_logs")
        .where({ project_id: key.projectId, log_date: key.logDate })
        .first();
    },

    activitiesFor(keys: DailyLogKey[]): Promise<DailyLogActivityRow[]> {
      if (keys.length === 0) return Promise.resolve([]);
      return db<DailyLogActivityRow>("daily_log_activities")
        .where(function () {
          for (const key of keys) {
            this.orWhere(function () {
              this.where({ project_id: key.projectId, log_date: key.logDate });
            });
          }
        })
        .orderBy("activity_id", "asc");
    },

    async upsert(
      key: DailyLogKey,
      input: UpsertDailyLogInput,
      actorId: string,
    ): Promise<DailyLogRow> {
      const patch = toRowPatch(input);
      const existing = await db<DailyLogRow>("daily_logs")
        .where({ project_id: key.projectId, log_date: key.logDate })
        .first();

      if (existing) {
        const [row] = await db("daily_logs")
          .where({ project_id: key.projectId, log_date: key.logDate })
          .update({ ...patch, updated_at: new Date() })
          .returning<DailyLogRow[]>("*");
        if (!row) throw new Error("Failed to update daily log");
        return row;
      }

      const [row] = await db("daily_logs")
        .insert({
          project_id: key.projectId,
          log_date: key.logDate,
          ...patch,
          created_by_id: actorId,
        })
        .returning<DailyLogRow[]>("*");
      if (!row) throw new Error("Failed to insert daily log");
      return row;
    },

    async upsertActivityLink(
      key: DailyLogKey,
      activityId: string,
      hoursLogged: number,
    ): Promise<DailyLogActivityRow> {
      const existing = await db<DailyLogActivityRow>("daily_log_activities")
        .where({
          project_id: key.projectId,
          log_date: key.logDate,
          activity_id: activityId,
        })
        .first();

      if (existing) {
        const [row] = await db("daily_log_activities")
          .where({
            project_id: key.projectId,
            log_date: key.logDate,
            activity_id: activityId,
          })
          .update({ hours_logged: String(hoursLogged) })
          .returning<DailyLogActivityRow[]>("*");
        if (!row) throw new Error("Failed to update daily log activity");
        return row;
      }

      const [row] = await db("daily_log_activities")
        .insert({
          project_id: key.projectId,
          log_date: key.logDate,
          activity_id: activityId,
          hours_logged: String(hoursLogged),
        })
        .returning<DailyLogActivityRow[]>("*");
      if (!row) throw new Error("Failed to insert daily log activity");
      return row;
    },

    activityNamesByIds(activityIds: string[]): Promise<{ id: string; name: string }[]> {
      if (activityIds.length === 0) return Promise.resolve([]);
      return db("activities").whereIn("id", activityIds).select("id", "name");
    },

    findActivity(projectId: string, activityId: string): Promise<{ id: string } | undefined> {
      return db("activities")
        .where({ id: activityId, project_id: projectId })
        .select<{ id: string }>("id")
        .first();
    },

    async deleteOne(key: DailyLogKey): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("daily_log_activities")
          .where({ project_id: key.projectId, log_date: key.logDate })
          .del();
        await trx("daily_logs")
          .where({ project_id: key.projectId, log_date: key.logDate })
          .del();
      });
    },
  };
}

export type DailyLogsRepository = ReturnType<typeof dailyLogsRepository>;

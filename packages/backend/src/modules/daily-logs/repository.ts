import type { Knex } from "knex";
import { generateId } from "../../lib/ids.ts";
import type {
  DailyLogActivityRow,
  DailyLogEntryRow,
  DailyLogEntryVoidRow,
  DailyLogRow,
  UpsertDailyLogInput,
  WeatherCondition,
} from "./types.ts";

export interface DailyLogKey {
  projectId: string;
  buildingId: string;
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
  if (input.summaryHtml !== undefined) set("summary_html", input.summaryHtml);
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
        .where({ project_id: key.projectId, building_id: key.buildingId, log_date: key.logDate })
        .first();
    },

    activitiesFor(keys: DailyLogKey[]): Promise<DailyLogActivityRow[]> {
      if (keys.length === 0) return Promise.resolve([]);
      return db<DailyLogActivityRow>("daily_log_activities")
        .where(function () {
          for (const key of keys) {
            this.orWhere(function () {
              this.where({ project_id: key.projectId, building_id: key.buildingId, log_date: key.logDate });
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
        .where({ project_id: key.projectId, building_id: key.buildingId, log_date: key.logDate })
        .first();

      if (existing) {
        const [row] = await db("daily_logs")
          .where({ project_id: key.projectId, building_id: key.buildingId, log_date: key.logDate })
          .update({ ...patch, updated_at: new Date() })
          .returning<DailyLogRow[]>("*");
        if (!row) throw new Error("Failed to update daily log");
        return row;
      }

      const [row] = await db("daily_logs")
        .insert({
          project_id: key.projectId,
          building_id: key.buildingId,
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
          building_id: key.buildingId,
          log_date: key.logDate,
          activity_id: activityId,
        })
        .first();

      if (existing) {
        const [row] = await db("daily_log_activities")
          .where({
            project_id: key.projectId,
            building_id: key.buildingId,
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
          building_id: key.buildingId,
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

    findActivity(projectId: string, activityId: string): Promise<{ id: string; name: string; building_id: string } | undefined> {
      return db("activities")
        .where({ id: activityId, project_id: projectId })
        .select<{ id: string; name: string; building_id: string }>("id", "name", "building_id")
        .first();
    },

    async voidOne(key: DailyLogKey, reason: string, actorId: string | null): Promise<DailyLogRow> {
      const [row] = await db("daily_logs")
        .where({ project_id: key.projectId, building_id: key.buildingId, log_date: key.logDate })
        .update({
          voided_at: new Date(),
          voided_by_id: actorId,
          void_reason: reason,
          updated_at: new Date(),
        })
        .returning<DailyLogRow[]>("*");
      if (!row) throw new Error("Failed to void daily log");
      return row;
    },

    voidersByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return Promise.resolve([]);
      return db("user").whereIn("id", unique).select("id", "name");
    },

    entriesForDays(keys: DailyLogKey[]): Promise<DailyLogEntryRow[]> {
      if (keys.length === 0) return Promise.resolve([]);
      return db<DailyLogEntryRow>("daily_log_entries")
        .where(function () {
          for (const key of keys) {
            this.orWhere(function () {
              this.where({ project_id: key.projectId, building_id: key.buildingId, log_date: key.logDate });
            });
          }
        })
        .orderBy("created_at", "asc");
    },

    findEntryById(entryId: string): Promise<DailyLogEntryRow | undefined> {
      return db<DailyLogEntryRow>("daily_log_entries").where({ id: entryId }).first();
    },

    async insertEntry(record: {
      projectId: string;
      buildingId: string;
      logDate: string;
      authorId: string | null;
      authorName: string;
      authorRole: string;
      bodyHtml: string | null;
      bodyText: string | null;
    }): Promise<DailyLogEntryRow> {
      const [row] = await db<DailyLogEntryRow>("daily_log_entries")
        .insert({
          id: generateId("dle"),
          project_id: record.projectId,
          building_id: record.buildingId,
          log_date: record.logDate,
          author_id: record.authorId,
          author_name: record.authorName,
          author_role: record.authorRole,
          body_html: record.bodyHtml,
          body_text: record.bodyText,
        })
        .returning("*");
      if (!row) throw new Error("Failed to insert daily log entry");
      return row;
    },

    voidsForEntries(entryIds: string[]): Promise<DailyLogEntryVoidRow[]> {
      if (entryIds.length === 0) return Promise.resolve([]);
      return db<DailyLogEntryVoidRow>("daily_log_entry_voids")
        .whereIn("entry_id", entryIds)
        .orderBy("voided_at", "asc");
    },

    async insertEntryVoid(record: {
      entryId: string;
      reason: string;
      voidedById: string | null;
      voidedByName: string;
    }): Promise<DailyLogEntryVoidRow> {
      const [row] = await db<DailyLogEntryVoidRow>("daily_log_entry_voids")
        .insert({
          id: generateId("dlv"),
          entry_id: record.entryId,
          reason: record.reason,
          voided_by_id: record.voidedById,
          voided_by_name: record.voidedByName,
        })
        .returning("*");
      if (!row) throw new Error("Failed to insert daily log entry void");
      return row;
    },
  };
}

export type DailyLogsRepository = ReturnType<typeof dailyLogsRepository>;

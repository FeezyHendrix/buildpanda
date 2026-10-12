import { BadRequestError } from "../../lib/errors.ts";
import { toIso } from "../../lib/dates.ts";
import type {
  DailyLog,
  DailyLogActivityLink,
  DailyLogDay,
  DailyLogEntry,
  DailyLogEntryRow,
  DailyLogEntryVoidRow,
  DailyLogRow,
} from "./types.ts";

/** Row -> DTO mapping and input checks shared by the daily-log service. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertDate(value: string, field: string): void {
  if (!DATE_RE.test(value)) {
    throw new BadRequestError(`${field} must be ISO date YYYY-MM-DD`);
  }
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

export function numOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function toLogDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function buildEntry(row: DailyLogEntryRow, voidRows: DailyLogEntryVoidRow[]): DailyLogEntry {
  const voids = voidRows
    .filter((v) => v.entry_id === row.id)
    .map((v) => ({
      id: v.id,
      reason: v.reason,
      voidedById: v.voided_by_id,
      voidedByName: v.voided_by_name,
      voidedAt: toIso(v.voided_at),
    }));
  return {
    id: row.id,
    projectId: row.project_id,
    buildingId: row.building_id,
    logDate: toLogDateString(row.log_date),
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    templateId: row.template_id,
    templateName: row.template_name,
    templateFields: row.template_fields,
    responses: row.responses,
    voids,
    voided: voids.length > 0,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function toDay(log: DailyLog, entries: DailyLogEntry[]): DailyLogDay {
  return {
    projectId: log.projectId,
    buildingId: log.buildingId,
    summary: log.summary,
    logDate: log.logDate,
    weatherCondition: log.weatherCondition,
    temperatureC: log.temperatureC,
    precipitationMm: log.precipitationMm,
    windKph: log.windKph,
    workersExpected: log.workersExpected,
    workersPresent: log.workersPresent,
    totalHours: log.totalHours,
    activities: log.activities,
    entries,
    voidedAt: log.voidedAt,
  };
}

export function buildLog(
  row: DailyLogRow,
  activities: DailyLogActivityLink[],
  voiderNames: Map<string, string>,
): DailyLog {
  return {
    projectId: row.project_id,
    buildingId: row.building_id,
    logDate: toLogDateString(row.log_date),
    weatherCondition: row.weather_condition,
    temperatureC: numOrNull(row.temperature_c),
    precipitationMm: numOrNull(row.precipitation_mm),
    windKph: numOrNull(row.wind_kph),
    workersExpected: row.workers_expected,
    workersPresent: row.workers_present,
    totalHours: Number(row.total_hours),
    summary: row.summary,
    summaryHtml: row.summary_html,
    activities,
    voidedAt: row.voided_at ? toIso(row.voided_at) : null,
    voidedById: row.voided_by_id,
    voidedByName: row.voided_by_id ? (voiderNames.get(row.voided_by_id) ?? null) : null,
    voidReason: row.void_reason,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

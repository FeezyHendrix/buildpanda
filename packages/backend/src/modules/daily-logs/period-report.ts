import type { Knex } from "knex";
import { NotFoundError } from "../../lib/errors.ts";
import {
  computePeriodRange,
  REPORT_PERIOD_LABEL,
  type ReportPeriod,
} from "../../lib/report-period.ts";
import {
  renderPeriodReportDocx,
  type PeriodReportDayRow,
  type PeriodReportDocxData,
  type PeriodReportNarrativeEntry,
} from "../../lib/period-report-docx.ts";
import { generateId } from "../../lib/ids.ts";
import { activitiesRepository } from "../activities/repository.ts";
import { projectsRepository } from "../projects/repository.ts";
import type { ActivityStatus } from "../activities/types.ts";
import type { DailyLogsService } from "./service.ts";
import type { WeatherCondition } from "./types.ts";

const STATUS_LABEL: Record<ActivityStatus, string> = {
  Planned: "Planned",
  InProgress: "In Progress",
  Completed: "Done",
  Cancelled: "Cancelled",
};

const WEATHER_LABEL: Record<WeatherCondition, string> = {
  Sunny: "Sunny",
  Cloudy: "Cloudy",
  Rain: "Rain",
  Storm: "Storm",
  Fog: "Fog",
  ExtremeHeat: "Extreme heat",
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Diary text is stored as HTML from the editor. A .docx is not HTML, so the
 * tags come out and the entities come back — otherwise "Hoarding & site
 * security" reaches the Resident Engineer as "Hoarding &amp; site security"
 * (finding F11).
 */
function toPlainText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => ENTITIES[match] ?? match)
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDayDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function formatWeekday(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export interface PeriodReportResult {
  docx: Buffer;
  fileName: string;
  /** ISO timestamp the document was produced; also printed in the header. */
  generatedAt: string;
}

export interface PeriodReportActor {
  id: string;
  name: string | null;
}

export interface PeriodReportDeps {
  logs: DailyLogsService;
}

export function periodReportService(db: Knex, deps: PeriodReportDeps) {
  const projects = projectsRepository(db);
  const activities = activitiesRepository(db);

  async function build(
    projectId: string,
    period: ReportPeriod,
    referenceDate: string,
    actor?: PeriodReportActor,
  ): Promise<PeriodReportResult> {
    const project = await projects.findById(projectId);
    if (!project) throw new NotFoundError("Project");

    const range = computePeriodRange(period, referenceDate);

    let companyName = "BuildPanda";
    if (project.organization_id) {
      const org = await db("organization")
        .where({ id: project.organization_id })
        .first<{ name: string } | undefined>("name");
      if (org?.name) companyName = org.name;
    }

    const days = await deps.logs.listDays(projectId, range.from, range.to);

    const activityRows = await activities.listByProject(projectId);
    const activityById = new Map(activityRows.map((row) => [row.id, row]));
    const phaseRows = await activities.phaseNamesForProject(projectId);
    const phaseById = new Map(phaseRows.map((row) => [row.id, row.name]));

    const hoursByActivity = new Map<string, { name: string; hours: number }>();
    for (const day of days) {
      for (const link of day.activities) {
        const existing = hoursByActivity.get(link.activityId);
        if (existing) existing.hours += link.hoursLogged;
        else hoursByActivity.set(link.activityId, { name: link.activityName, hours: link.hoursLogged });
      }
    }
    const activityRowsForPeriod = Array.from(hoursByActivity.entries())
      .map(([activityId, agg]) => {
        const detail = activityById.get(activityId);
        return {
          name: toPlainText(agg.name) || agg.name,
          phase: detail?.phase_id ? (phaseById.get(detail.phase_id) ?? null) : null,
          trade: detail?.activity_type ?? null,
          status: detail ? STATUS_LABEL[detail.status] : "—",
          percentComplete: detail ? clampPercent(Number(detail.percent_complete)) : 0,
          hours: agg.hours.toFixed(1),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalHours = days.reduce((sum, d) => sum + d.totalHours, 0);
    const daysLogged = days.length;
    const totalDaysInPeriod =
      Math.round(
        (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000,
      ) + 1;
    const totalWorkerDays = days.reduce((sum, d) => sum + d.workersPresent, 0);
    const avgCrew = daysLogged > 0 ? totalWorkerDays / daysLogged : 0;

    const weatherCounts = new Map<WeatherCondition, number>();
    for (const day of days) {
      if (day.weatherCondition) {
        weatherCounts.set(day.weatherCondition, (weatherCounts.get(day.weatherCondition) ?? 0) + 1);
      }
    }

    // A logged day with no crew and no hours is a stoppage, not an empty row —
    // the report has to say why the site did nothing (finding F11).
    const dayRows: PeriodReportDayRow[] = days
      .map((day): PeriodReportDayRow => {
        const notes: string[] = [];
        if (day.voidedAt) notes.push("Day voided");
        if (day.workersPresent === 0 && day.totalHours === 0) {
          notes.push(
            day.weatherCondition === "Rain" || day.weatherCondition === "Storm"
              ? "No work — weather"
              : "No work recorded",
          );
        }
        if (day.precipitationMm !== null && day.precipitationMm > 0) {
          notes.push(`${day.precipitationMm} mm rain`);
        }
        return {
          date: formatDayDate(day.logDate),
          weekday: formatWeekday(day.logDate),
          weather: day.weatherCondition
            ? `${WEATHER_LABEL[day.weatherCondition]}${day.temperatureC !== null ? ` · ${day.temperatureC}°C` : ""}`
            : "—",
          crew: `${day.workersPresent}/${day.workersExpected}`,
          hours: day.totalHours.toFixed(1),
          entries: day.entries.filter((entry) => !entry.voided).length,
          note: notes.join(" · "),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const narrative: PeriodReportNarrativeEntry[] = [];
    for (const day of [...days].sort((a, b) => a.logDate.localeCompare(b.logDate))) {
      for (const entry of day.entries) {
        const body = toPlainText(entry.bodyText ?? entry.bodyHtml);
        if (!body) continue;
        narrative.push({
          date: `${formatWeekday(day.logDate)} ${formatDayDate(day.logDate)}`,
          author: toPlainText(entry.authorName) || "Unknown",
          body,
          // Voided entries stay in the report, struck through with the reason:
          // that trail is the audit, and removing it rewrites history.
          voided: entry.voided,
          voidReason: entry.voided ? (toPlainText(entry.voids.at(-1)?.reason ?? null) || null) : null,
        });
      }
    }

    const generatedAt = new Date().toISOString();

    const data: PeriodReportDocxData = {
      companyName,
      projectName: project.name,
      projectAddress: project.address,
      periodTypeLabel: REPORT_PERIOD_LABEL[period],
      rangeLabel: range.rangeLabel,
      generatedAtLabel: formatTimestamp(generatedAt),
      overallProgressPercent: clampPercent(Number(project.progress_percent)),
      kpis: [
        { label: "Days logged", value: `${daysLogged} / ${totalDaysInPeriod}` },
        { label: "Total hours logged", value: totalHours.toFixed(1) },
        { label: "Average crew size", value: avgCrew.toFixed(1) },
        { label: "Total worker-days", value: String(totalWorkerDays) },
      ],
      weatherBreakdown: Array.from(weatherCounts.entries()).map(([condition, count]) => ({
        label: WEATHER_LABEL[condition],
        value: `${count} day${count === 1 ? "" : "s"}`,
      })),
      activities: activityRowsForPeriod,
      days: dayRows,
      narrative,
    };

    const docx = await renderPeriodReportDocx(data);
    const slug = project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const fileName = `${period}-report-${slug}-${range.from}-to-${range.to}.docx`;

    // Issuing a report is an event. Keeping the figures it carried lets the next
    // download be compared with the one that went to the RE (finding F12).
    await db("daily_log_reports")
      .insert({
        id: generateId("dlrep"),
        project_id: projectId,
        period,
        range_from: range.from,
        range_to: range.to,
        file_name: fileName,
        snapshot: JSON.stringify({
          daysLogged,
          totalDaysInPeriod,
          totalHours,
          avgCrew,
          narrativeEntries: narrative.length,
          voidedEntries: narrative.filter((entry) => entry.voided).length,
        }),
        generated_by_id: actor?.id ?? null,
        generated_by_name: actor?.name ?? null,
        generated_at: generatedAt,
      })
      .catch(() => undefined);

    return { docx, fileName, generatedAt };
  }

  return { build };
}

export type PeriodReportService = ReturnType<typeof periodReportService>;

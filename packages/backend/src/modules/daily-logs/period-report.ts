import type { Knex } from "knex";
import { NotFoundError } from "../../lib/errors.ts";
import {
  computePeriodRange,
  REPORT_PERIOD_LABEL,
  type ReportPeriod,
} from "../../lib/report-period.ts";
import { renderPeriodReportDocx, type PeriodReportDocxData } from "../../lib/period-report-docx.ts";
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
          name: agg.name,
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

    const data: PeriodReportDocxData = {
      companyName,
      projectName: project.name,
      projectAddress: project.address,
      periodTypeLabel: REPORT_PERIOD_LABEL[period],
      rangeLabel: range.rangeLabel,
      generatedAtLabel: formatTimestamp(new Date().toISOString()),
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
    };

    const docx = await renderPeriodReportDocx(data);
    const slug = project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const fileName = `${period}-report-${slug}-${range.from}-to-${range.to}.docx`;
    return { docx, fileName };
  }

  return { build };
}

export type PeriodReportService = ReturnType<typeof periodReportService>;

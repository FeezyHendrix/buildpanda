import type { Knex } from "knex";
import { NotFoundError } from "../../lib/errors.ts";
import { renderDailyReportPdf, type DailyReportPdfData } from "../../lib/report-pdf.ts";
import { makeReportImageResolver } from "../../lib/report-image-resolver.ts";
import { renderEmail, calloutBox, metaTable, infoRow } from "../../lib/email-templates.ts";
import { sendEmail } from "../../lib/mail.ts";
import { config } from "../../config/index.ts";
import { activitiesRepository } from "../activities/repository.ts";
import { projectsRepository } from "../projects/repository.ts";
import { stagesRepository } from "../stages/repository.ts";
import { stagesService } from "../stages/service.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import type { FilesService } from "../files/service.ts";
import type { ActivityStatus } from "../activities/types.ts";
import type { DailyLogsService } from "./service.ts";
import type { DailyLogDay } from "./types.ts";

const STATUS_LABEL: Record<ActivityStatus, string> = {
  Planned: "Planned",
  InProgress: "In Progress",
  Completed: "Done",
  Cancelled: "Cancelled",
};

const WEATHER_LABEL: Record<string, string> = {
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

function formatLongDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
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

export interface DailyReportResult {
  pdf: Buffer;
  fileName: string;
  data: DailyReportPdfData;
  day: DailyLogDay;
}

export interface DailyReportDeps {
  logs: DailyLogsService;
  files: FilesService;
}

export function dailyReportService(db: Knex, deps: DailyReportDeps) {
  const projects = projectsRepository(db);
  const activities = activitiesRepository(db);
  const buildings = buildingsRepository(db);
  const stagesSvc = stagesService(stagesRepository(db), (projectId) =>
    buildings.soleRealBuildingId(projectId),
  );
  const resolveImage = makeReportImageResolver(deps.files);

  async function build(projectId: string, logDate: string): Promise<DailyReportResult> {
    const day = await deps.logs.getDay(projectId, logDate);
    const project = await projects.findById(projectId);
    if (!project) throw new NotFoundError("Project");

    let companyName = "BuildPanda";
    if (project.organization_id) {
      const org = await db("organization")
        .where({ id: project.organization_id })
        .first<{ name: string } | undefined>("name");
      if (org?.name) companyName = org.name;
    }

    const activityRows = await activities.listByProject(projectId);
    const activityById = new Map(activityRows.map((row) => [row.id, row]));
    const phaseRows = await activities.phaseNamesForProject(projectId);
    const phaseById = new Map(phaseRows.map((row) => [row.id, row.name]));

    const reportActivities = day.activities.map((link) => {
      const detail = activityById.get(link.activityId);
      const percent = detail ? clampPercent(Number(detail.percent_complete)) : 0;
      return {
        name: link.activityName,
        phase: detail?.phase_id ? (phaseById.get(detail.phase_id) ?? null) : null,
        trade: detail?.activity_type ?? null,
        assignee: detail?.assignee_name ?? null,
        status: detail ? STATUS_LABEL[detail.status] : "—",
        percentComplete: percent,
        hours: String(link.hoursLogged),
        _hours: link.hoursLogged,
      };
    });

    // Daily activity progress = hours-weighted average of the day's activities'
    // completion, so a long task dominates a short one. Falls back to a plain
    // mean when no hours were logged, and to 0 when nothing was linked.
    const totalWeight = reportActivities.reduce((sum, a) => sum + a._hours, 0);
    let dailyProgressPercent = 0;
    if (totalWeight > 0) {
      dailyProgressPercent =
        reportActivities.reduce((sum, a) => sum + a.percentComplete * a._hours, 0) / totalWeight;
    } else if (reportActivities.length > 0) {
      dailyProgressPercent =
        reportActivities.reduce((sum, a) => sum + a.percentComplete, 0) / reportActivities.length;
    }

    const weather: DailyReportPdfData["weather"] = [];
    if (day.weatherCondition) {
      weather.push({
        label: "Condition",
        value: WEATHER_LABEL[day.weatherCondition] ?? day.weatherCondition,
      });
    }
    if (day.temperatureC !== null) {
      weather.push({ label: "Temperature", value: `${day.temperatureC}°C` });
    }
    if (day.windKph !== null) {
      weather.push({ label: "Wind", value: `${day.windKph} km/h` });
    }
    if (day.precipitationMm !== null) {
      weather.push({ label: "Precipitation", value: `${day.precipitationMm} mm` });
    }

    const stages = await stagesSvc.list(projectId).catch(() => []);
    const firstActiveStage = stages.findIndex((s) => s.status === "InProgress");

    const data: DailyReportPdfData = {
      companyName,
      projectName: project.name,
      projectAddress: project.address,
      reportDateLabel: formatLongDate(day.logDate),
      generatedAtLabel: formatTimestamp(new Date().toISOString()),
      voided: null,
      overallProgressPercent: clampPercent(Number(project.progress_percent)),
      dailyProgressPercent: clampPercent(dailyProgressPercent),
      weather,
      workforce: [
        { label: "Workers expected", value: String(day.workersExpected) },
        { label: "Workers present", value: String(day.workersPresent) },
        { label: "Total hours", value: String(day.totalHours) },
      ],
      activities: reportActivities.map((a) => ({
        name: a.name,
        phase: a.phase,
        trade: a.trade,
        assignee: a.assignee,
        status: a.status,
        percentComplete: a.percentComplete,
        hours: a.hours,
      })),
      summary: null,
      stageSummary: stages.map((s, i) => ({
        name: s.name,
        status: s.status === "InProgress" ? "In Progress" : s.status,
        percent: s.progressPercent,
        current: s.status === "InProgress" || (firstActiveStage === -1 && i === stages.length - 1 && s.status !== "Done"),
      })),
      entries: day.entries.map((e) => {
        const lastVoid = e.voids.length > 0 ? e.voids[e.voids.length - 1]! : null;
        return {
          authorName: e.authorName,
          authorRole: e.authorRole,
          addedAt: formatTimestamp(e.createdAt),
          bodyHtml: e.bodyHtml,
          voided: e.voided,
          voidReason: lastVoid?.reason ?? null,
          voidedBy: lastVoid?.voidedByName ?? null,
          voidedAt: lastVoid ? formatTimestamp(lastVoid.voidedAt) : null,
        };
      }),
    };

    const pdf = await renderDailyReportPdf(data, { resolveImage });
    const fileName = `daily-report-${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${day.logDate}.pdf`;
    return { pdf, fileName, data, day };
  }

  async function emailTo(
    projectId: string,
    logDate: string,
    recipient: { email: string; name: string },
  ): Promise<DailyReportResult> {
    const report = await build(projectId, logDate);
    const projectUrl = `${config.mail.appUrl.replace(/\/+$/, "")}/project/${projectId}/daily-log`;

    const rows = [
      infoRow("Project", report.data.projectName),
      infoRow("Report date", report.data.reportDateLabel),
      infoRow("Overall completion", `${report.data.overallProgressPercent.toFixed(0)}%`),
      infoRow("Workers present", `${report.data.workforce[1]?.value ?? "—"}`),
    ].join("");

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Your daily site report for <strong>${report.data.projectName}</strong> is ready. The full report is attached as a PDF.</p>
      ${metaTable(rows)}
      ${report.data.voided ? calloutBox("This day's log has been <strong>voided</strong>. The report reflects the voided record.", "danger") : ""}
    `;

    const html = renderEmail({
      preview: `Daily site report — ${report.data.reportDateLabel}`,
      eyebrow: "Daily report",
      heading: "Your daily site report is ready",
      bodyHtml,
      cta: { label: "Open daily logs", url: projectUrl },
      footnote: "You received this because you requested a daily report in BuildPanda.",
    });

    await sendEmail({
      to: recipient.email,
      toName: recipient.name,
      subject: `Daily Site Report — ${report.data.projectName} — ${report.data.reportDateLabel}`,
      html,
      attachments: [
        { content: report.pdf, name: report.fileName, mimeType: "application/pdf" },
      ],
    });

    return report;
  }

  return { build, emailTo };
}

export type DailyReportService = ReturnType<typeof dailyReportService>;

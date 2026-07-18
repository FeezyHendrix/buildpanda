import api from "./client";
import type {
  DailyLog,
  DailyLogDay,
  DailyLogEntry,
  ReportPeriod,
  WeatherCondition,
} from "@/lib/project-types";

export interface AddDailyLogEntryInput {
  projectId: string;
  logDate: string;
  bodyHtml: string;
  bodyText?: string | null;
}

export interface VoidDailyLogEntryInput {
  projectId: string;
  logDate: string;
  entryId: string;
  reason: string;
}

export interface UpsertDailyLogInput {
  projectId: string;
  logDate: string;
  weatherCondition?: WeatherCondition | null;
  temperatureC?: number | null;
  precipitationMm?: number | null;
  windKph?: number | null;
  workersExpected?: number;
  workersPresent?: number;
  totalHours?: number;
  summary?: string | null;
  summaryHtml?: string | null;
}

export interface LinkDailyLogActivityInput {
  projectId: string;
  logDate: string;
  activityId: string;
  hoursLogged: number;
}

export interface VoidDailyLogInput {
  projectId: string;
  logDate: string;
  reason: string;
}

export const dailyLogsApi = {
  list: (projectId: string, range?: { from?: string; to?: string }, buildingId?: string) =>
    api
      .get<DailyLogDay[]>(`/projects/${projectId}/daily-logs`, {
        params: range || buildingId ? { ...range, ...(buildingId ? { buildingId } : {}) } : undefined,
      })
      .then((r) => r.data),

  addEntry: (projectId: string, logDate: string, body: { bodyHtml: string; bodyText: string | null }) =>
    api.post<DailyLogEntry>(`/projects/${projectId}/daily-logs/${logDate}/entries`, body).then((r) => r.data),

  voidEntry: (projectId: string, logDate: string, entryId: string, body: { reason: string }) =>
    api.post<DailyLogEntry>(`/projects/${projectId}/daily-logs/${logDate}/entries/${entryId}/void`, body).then((r) => r.data),

  detail: (projectId: string, date: string) =>
    api.get<DailyLogDay>(`/projects/${projectId}/daily-logs/${date}/day`).then((r) => r.data),

  upsert: (projectId: string, logDate: string, body: Omit<UpsertDailyLogInput, "projectId" | "logDate">) =>
    api.put<DailyLog>(`/projects/${projectId}/daily-logs/${logDate}`, body).then((r) => r.data),

  linkActivity: (projectId: string, logDate: string, body: { activityId: string; hoursLogged: number }) =>
    api.post<{ projectId: string; logDate: string; activityId: string; hoursLogged: number }>(
      `/projects/${projectId}/daily-logs/${logDate}/activities`,
      body,
    ).then((r) => r.data),

  voidLog: (projectId: string, logDate: string, body: { reason: string }) =>
    api.post<DailyLog>(`/projects/${projectId}/daily-logs/${logDate}/void`, body).then((r) => r.data),

  downloadReport: (projectId: string, logDate: string) =>
    api.get<Blob>(`/projects/${projectId}/daily-logs/${logDate}/report`, { responseType: "blob" }).then((r) => r.data),

  emailReport: (projectId: string, logDate: string, email?: string) =>
    api.post<{ sentTo: string; logDate: string }>(
      `/projects/${projectId}/daily-logs/${logDate}/report/email`,
      email ? { email } : {},
    ).then((r) => r.data),

  downloadPeriodReport: (projectId: string, period: ReportPeriod, date: string) =>
    api.get<Blob>(`/projects/${projectId}/daily-logs/period-report`, {
      params: { period, date },
      responseType: "blob",
    }).then((r) => r.data),
};

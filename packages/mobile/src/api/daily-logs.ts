import { request } from "./client";

export const WEATHER_CONDITIONS = [
  "Sunny",
  "Cloudy",
  "Rain",
  "Storm",
  "Fog",
  "ExtremeHeat",
] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export interface DailyLogEntry {
  id: string;
  authorName: string;
  bodyHtml: string | null;
  bodyText: string | null;
  voided: boolean;
  createdAt: string;
}

export interface DailyLogDay {
  projectId: string;
  logDate: string;
  weatherCondition: WeatherCondition | null;
  temperatureC: number | null;
  workersExpected: number;
  workersPresent: number;
  totalHours: number;
  entries: DailyLogEntry[];
  voidedAt?: string | null;
}

/** The log itself is keyed by date, not id — one log per project per day. */
export interface UpsertDailyLogInput {
  totalHours?: number;
  summary?: string | null;
  buildingId?: string | null;
}

export const dailyLogsApi = {
  list: (projectId: string, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const suffix = query.toString() ? `?${query}` : "";
    return request<DailyLogDay[]>(`/projects/${projectId}/daily-logs${suffix}`);
  },

  day: (projectId: string, date: string) =>
    request<DailyLogDay>(`/projects/${projectId}/daily-logs/${date}/day`),

  upsert: (projectId: string, date: string, body: UpsertDailyLogInput) =>
    request<DailyLogDay>(`/projects/${projectId}/daily-logs/${date}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  linkActivity: (projectId: string, date: string, activityId: string, hoursLogged: number) =>
    request<{ activityId: string }>(`/projects/${projectId}/daily-logs/${date}/activities`, {
      method: "POST",
      body: JSON.stringify({ activityId, hoursLogged }),
    }),

  addEntry: (
    projectId: string,
    date: string,
    bodyHtml: string,
    bodyText: string,
    buildingId?: string | null,
  ) =>
    request<DailyLogEntry>(`/projects/${projectId}/daily-logs/${date}/entries`, {
      method: "POST",
      body: JSON.stringify({ bodyHtml, bodyText, ...(buildingId ? { buildingId } : {}) }),
    }),

  voidEntry: (projectId: string, date: string, entryId: string, reason: string) =>
    request<{ id: string }>(`/projects/${projectId}/daily-logs/${date}/entries/${entryId}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

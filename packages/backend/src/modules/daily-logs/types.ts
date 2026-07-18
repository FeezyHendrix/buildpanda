export type WeatherCondition =
  | "Sunny"
  | "Cloudy"
  | "Rain"
  | "Storm"
  | "Fog"
  | "ExtremeHeat";

export interface DailyLogActivityLink {
  activityId: string;
  activityName: string;
  hoursLogged: number;
}

export interface DailyLog {
  projectId: string;
  logDate: string;
  weatherCondition: WeatherCondition | null;
  temperatureC: number | null;
  precipitationMm: number | null;
  windKph: number | null;
  workersExpected: number;
  workersPresent: number;
  totalHours: number;
  summary: string | null;
  summaryHtml: string | null;
  activities: DailyLogActivityLink[];
  voidedAt: string | null;
  voidedById: string | null;
  voidedByName: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogRow {
  project_id: string;
  building_id: string;
  log_date: Date | string;
  weather_condition: WeatherCondition | null;
  temperature_c: string | null;
  precipitation_mm: string | null;
  wind_kph: string | null;
  workers_expected: number;
  workers_present: number;
  total_hours: string;
  summary: string | null;
  summary_html: string | null;
  created_by_id: string | null;
  voided_at: Date | string | null;
  voided_by_id: string | null;
  void_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DailyLogActivityRow {
  project_id: string;
  building_id: string;
  log_date: Date | string;
  activity_id: string;
  hours_logged: string;
}

export interface UpsertDailyLogInput {
  buildingId?: string | null;
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

export interface LinkActivityInput {
  activityId: string;
  hoursLogged: number;
}

export interface DailyLogEntryVoid {
  id: string;
  reason: string;
  voidedById: string | null;
  voidedByName: string;
  voidedAt: string;
}

export interface DailyLogEntry {
  id: string;
  projectId: string;
  logDate: string;
  authorId: string | null;
  authorName: string;
  authorRole: string;
  bodyHtml: string | null;
  bodyText: string | null;
  voids: DailyLogEntryVoid[];
  voided: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogEntryRow {
  id: string;
  project_id: string;
  building_id: string;
  log_date: Date | string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  body_html: string | null;
  body_text: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DailyLogEntryVoidRow {
  id: string;
  entry_id: string;
  reason: string;
  voided_by_id: string | null;
  voided_by_name: string;
  voided_at: Date | string;
}

export interface CreateDailyLogEntryInput {
  bodyHtml: string;
  bodyText?: string | null;
}

export interface DailyLogDay {
  projectId: string;
  logDate: string;
  weatherCondition: WeatherCondition | null;
  temperatureC: number | null;
  precipitationMm: number | null;
  windKph: number | null;
  workersExpected: number;
  workersPresent: number;
  totalHours: number;
  activities: DailyLogActivityLink[];
  entries: DailyLogEntry[];
}

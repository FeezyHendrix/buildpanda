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
  log_date: Date | string;
  weather_condition: WeatherCondition | null;
  temperature_c: string | null;
  precipitation_mm: string | null;
  wind_kph: string | null;
  workers_expected: number;
  workers_present: number;
  total_hours: string;
  summary: string | null;
  created_by_id: string | null;
  voided_at: Date | string | null;
  voided_by_id: string | null;
  void_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DailyLogActivityRow {
  project_id: string;
  log_date: Date | string;
  activity_id: string;
  hours_logged: string;
}

export interface UpsertDailyLogInput {
  weatherCondition?: WeatherCondition | null;
  temperatureC?: number | null;
  precipitationMm?: number | null;
  windKph?: number | null;
  workersExpected?: number;
  workersPresent?: number;
  totalHours?: number;
  summary?: string | null;
}

export interface LinkActivityInput {
  activityId: string;
  hoursLogged: number;
}

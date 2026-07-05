import api from "./client";
import type { WeatherCondition } from "@/lib/project-types";

export interface WeatherSnapshot {
  condition: WeatherCondition;
  temperatureC: number;
  windKph: number;
  precipitationMm: number;
}

export interface WeatherForecastDay {
  date: string;
  condition: WeatherCondition;
  conditionLabel: string;
  temperatureMaxC: number;
  temperatureMinC: number;
  precipitationMm: number;
  windKph: number;
}

export interface WeatherForecast {
  locationName: string | null;
  current: WeatherSnapshot | null;
  forecast: WeatherForecastDay[];
}

export interface WeatherAnalysis {
  available: boolean;
  headline: string | null;
  impact: string | null;
  scheduleImpact: string | null;
  costImpact: string | null;
  recommendations: string[];
  riskLevel: "low" | "medium" | "high" | null;
}

export const weatherApi = {
  current: (projectId: string) =>
    api.get<{ weather: WeatherSnapshot | null }>(`/projects/${projectId}/weather/current`).then((r) => r.data.weather),
  forecast: (projectId: string) =>
    api.get<WeatherForecast>(`/projects/${projectId}/weather/forecast`).then((r) => r.data),
  analysis: (projectId: string) =>
    api.get<WeatherAnalysis>(`/projects/${projectId}/weather/analysis`).then((r) => r.data),
};

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
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

const weatherKeys = {
  current: (projectId: string) => ["projects", projectId, "weather", "current"] as const,
  forecast: (projectId: string) => ["projects", projectId, "weather", "forecast"] as const,
  analysis: (projectId: string) => ["projects", projectId, "weather", "analysis"] as const,
};

export function useCurrentWeather(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId ? weatherKeys.current(projectId) : ["weather", "none"],
    queryFn: async () => {
      const { data } = await api.get<{ weather: WeatherSnapshot | null }>(
        `/projects/${projectId!}/weather/current`,
      );
      return data.weather;
    },
    enabled: Boolean(projectId) && enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useWeatherForecast(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? weatherKeys.forecast(projectId) : ["weather", "none"],
    queryFn: async () => {
      const { data } = await api.get<WeatherForecast>(`/projects/${projectId!}/weather/forecast`);
      return data;
    },
    enabled: Boolean(projectId),
    staleTime: 30 * 60 * 1000,
  });
}

export function useWeatherAnalysis(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? weatherKeys.analysis(projectId) : ["weather", "none"],
    queryFn: async () => {
      const { data } = await api.get<WeatherAnalysis>(`/projects/${projectId!}/weather/analysis`);
      return data;
    },
    enabled: Boolean(projectId),
    staleTime: 30 * 60 * 1000,
  });
}

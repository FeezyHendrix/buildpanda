import { useQuery } from "@tanstack/react-query";
import { weatherApi } from "@/api/weather";
import type {
  WeatherSnapshot,
  WeatherForecastDay,
  WeatherForecast,
  WeatherAnalysis,
} from "@/api/weather";

export type {
  WeatherSnapshot,
  WeatherForecastDay,
  WeatherForecast,
  WeatherAnalysis,
};

const weatherKeys = {
  current: (projectId: string) => ["projects", projectId, "weather", "current"] as const,
  forecast: (projectId: string) => ["projects", projectId, "weather", "forecast"] as const,
  analysis: (projectId: string) => ["projects", projectId, "weather", "analysis"] as const,
};

export function useCurrentWeather(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId ? weatherKeys.current(projectId) : ["weather", "none"],
    queryFn: () => weatherApi.current(projectId!),
    enabled: Boolean(projectId) && enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useWeatherForecast(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? weatherKeys.forecast(projectId) : ["weather", "none"],
    queryFn: () => weatherApi.forecast(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30 * 60 * 1000,
  });
}

export function useWeatherAnalysis(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? weatherKeys.analysis(projectId) : ["weather", "none"],
    queryFn: () => weatherApi.analysis(projectId!),
    enabled: Boolean(projectId),
    staleTime: 30 * 60 * 1000,
  });
}

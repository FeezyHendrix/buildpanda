import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { dailyLogKeys } from "./query-keys";
import type { DailyLog, WeatherCondition } from "@/lib/project-mock-data";

export function useProjectDailyLogs(
  projectId: string | undefined,
  range?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: projectId
      ? dailyLogKeys.list(projectId, range)
      : dailyLogKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<DailyLog[]>(
        `/projects/${projectId!}/daily-logs`,
        range ? { params: range } : undefined,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectDailyLog(
  projectId: string | undefined,
  date: string | undefined,
) {
  return useQuery({
    queryKey:
      projectId && date
        ? dailyLogKeys.detail(projectId, date)
        : dailyLogKeys.detail("__none__", "__none__"),
    queryFn: async () => {
      const { data } = await api.get<DailyLog>(
        `/projects/${projectId!}/daily-logs/${date!}`,
      );
      return data;
    },
    enabled: Boolean(projectId && date),
  });
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
}

export function useUpsertDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      logDate,
      ...body
    }: UpsertDailyLogInput) => {
      const { data } = await api.put<DailyLog>(
        `/projects/${projectId}/daily-logs/${logDate}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId, logDate }) => {
      queryClient.invalidateQueries({
        queryKey: dailyLogKeys.detail(projectId, logDate),
      });
      queryClient.invalidateQueries({ queryKey: dailyLogKeys.all(projectId) });
    },
  });
}

export interface LinkDailyLogActivityInput {
  projectId: string;
  logDate: string;
  activityId: string;
  hoursLogged: number;
}

export function useLinkDailyLogActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      logDate,
      activityId,
      hoursLogged,
    }: LinkDailyLogActivityInput) => {
      const { data } = await api.post<{
        projectId: string;
        logDate: string;
        activityId: string;
        hoursLogged: number;
      }>(`/projects/${projectId}/daily-logs/${logDate}/activities`, {
        activityId,
        hoursLogged,
      });
      return data;
    },
    onSuccess: (_data, { projectId, logDate }) => {
      queryClient.invalidateQueries({
        queryKey: dailyLogKeys.detail(projectId, logDate),
      });
    },
  });
}

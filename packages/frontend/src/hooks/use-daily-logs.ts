import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { dailyLogKeys } from "./query-keys";
import type { DailyLog, DailyLogDay, DailyLogEntry, WeatherCondition } from "@/lib/project-types";

export function useProjectDailyDays(
  projectId: string | undefined,
  range?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: projectId
      ? dailyLogKeys.list(projectId, range)
      : dailyLogKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<DailyLogDay[]>(
        `/projects/${projectId!}/daily-logs`,
        range ? { params: range } : undefined,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectDailyLogs(
  projectId: string | undefined,
  range?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: projectId
      ? dailyLogKeys.list(projectId, range)
      : dailyLogKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<DailyLogDay[]>(
        `/projects/${projectId!}/daily-logs`,
        range ? { params: range } : undefined,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export interface AddDailyLogEntryInput {
  projectId: string;
  logDate: string;
  bodyHtml: string;
  bodyText?: string | null;
}

export function useAddDailyLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, logDate, bodyHtml, bodyText }: AddDailyLogEntryInput) => {
      const { data } = await api.post<DailyLogEntry>(
        `/projects/${projectId}/daily-logs/${logDate}/entries`,
        { bodyHtml, bodyText: bodyText ?? null },
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: dailyLogKeys.all(projectId) });
    },
  });
}

export interface VoidDailyLogEntryInput {
  projectId: string;
  logDate: string;
  entryId: string;
  reason: string;
}

export function useVoidDailyLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, logDate, entryId, reason }: VoidDailyLogEntryInput) => {
      const { data } = await api.post<DailyLogEntry>(
        `/projects/${projectId}/daily-logs/${logDate}/entries/${entryId}/void`,
        { reason },
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: dailyLogKeys.all(projectId) });
    },
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
      const { data } = await api.get<DailyLogDay>(
        `/projects/${projectId!}/daily-logs/${date!}/day`,
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
  summaryHtml?: string | null;
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

export interface VoidDailyLogInput {
  projectId: string;
  logDate: string;
  reason: string;
}

export function useVoidDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, logDate, reason }: VoidDailyLogInput) => {
      const { data } = await api.post<DailyLog>(
        `/projects/${projectId}/daily-logs/${logDate}/void`,
        { reason },
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

export function useDownloadDailyReport() {
  return useMutation({
    mutationFn: async ({ projectId, logDate }: { projectId: string; logDate: string }) => {
      const response = await api.get<Blob>(
        `/projects/${projectId}/daily-logs/${logDate}/report`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `daily-report-${logDate}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  });
}

export function useEmailDailyReport() {
  return useMutation({
    mutationFn: async ({
      projectId,
      logDate,
      email,
    }: {
      projectId: string;
      logDate: string;
      email?: string;
    }) => {
      const { data } = await api.post<{ sentTo: string; logDate: string }>(
        `/projects/${projectId}/daily-logs/${logDate}/report/email`,
        email ? { email } : {},
      );
      return data;
    },
  });
}

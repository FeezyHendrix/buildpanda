import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dailyLogsApi,
  type AddDailyLogEntryInput,
  type VoidDailyLogEntryInput,
  type UpsertDailyLogInput,
  type LinkDailyLogActivityInput,
  type VoidDailyLogInput,
} from "@/api/daily-logs";
import { dailyLogKeys } from "./query-keys";
import type { ReportPeriod } from "@/lib/project-types";

export function useProjectDailyDays(
  projectId: string | undefined,
  range?: { from?: string; to?: string },
  buildingId?: string,
) {
  return useQuery({
    queryKey: projectId
      ? dailyLogKeys.list(projectId, range, buildingId)
      : dailyLogKeys.list("__none__"),
    queryFn: () => dailyLogsApi.list(projectId!, range, buildingId),
    enabled: Boolean(projectId),
  });
}

export function useProjectDailyLogs(
  projectId: string | undefined,
  range?: { from?: string; to?: string },
  buildingId?: string,
) {
  return useQuery({
    queryKey: projectId
      ? dailyLogKeys.list(projectId, range, buildingId)
      : dailyLogKeys.list("__none__"),
    queryFn: () => dailyLogsApi.list(projectId!, range, buildingId),
    enabled: Boolean(projectId),
  });
}

export function useAddDailyLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, logDate, bodyHtml, bodyText }: AddDailyLogEntryInput) => 
      dailyLogsApi.addEntry(projectId, logDate, { bodyHtml, bodyText: bodyText ?? null }),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: dailyLogKeys.all(projectId) });
    },
  });
}

export function useVoidDailyLogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, logDate, entryId, reason }: VoidDailyLogEntryInput) => 
      dailyLogsApi.voidEntry(projectId, logDate, entryId, { reason }),
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
    queryFn: () => dailyLogsApi.detail(projectId!, date!),
    enabled: Boolean(projectId && date),
  });
}

export function useUpsertDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      logDate,
      ...body
    }: UpsertDailyLogInput) => 
      dailyLogsApi.upsert(projectId, logDate, body),
    onSuccess: (_data, { projectId, logDate }) => {
      queryClient.invalidateQueries({
        queryKey: dailyLogKeys.detail(projectId, logDate),
      });
      queryClient.invalidateQueries({ queryKey: dailyLogKeys.all(projectId) });
    },
  });
}

export function useLinkDailyLogActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      logDate,
      activityId,
      hoursLogged,
    }: LinkDailyLogActivityInput) => 
      dailyLogsApi.linkActivity(projectId, logDate, {
        activityId,
        hoursLogged,
      }),
    onSuccess: (_data, { projectId, logDate }) => {
      queryClient.invalidateQueries({
        queryKey: dailyLogKeys.detail(projectId, logDate),
      });
    },
  });
}

export function useVoidDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, logDate, reason }: VoidDailyLogInput) => 
      dailyLogsApi.voidLog(projectId, logDate, { reason }),
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
      const data = await dailyLogsApi.downloadReport(projectId, logDate);
      const url = URL.createObjectURL(data);
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
    mutationFn: ({
      projectId,
      logDate,
      email,
    }: {
      projectId: string;
      logDate: string;
      email?: string;
    }) => dailyLogsApi.emailReport(projectId, logDate, email),
  });
}

export function useDownloadPeriodReport() {
  return useMutation({
    mutationFn: async ({
      projectId,
      period,
      date,
    }: {
      projectId: string;
      period: ReportPeriod;
      date: string;
    }) => {
      const data = await dailyLogsApi.downloadPeriodReport(projectId, period, date);
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${period}-report-${date}.docx`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { stagesApi, type StageScheduleOfValue } from "@/api/stages";
import { stageKeys } from "@/hooks/query-keys";

/**
 * Drops a billing month from the sheet.
 *
 * A month is only a column because some stage has a line in it, so removing it
 * means rewriting each of those stages' schedules without that period. The API
 * refuses the drop if the month has been certified on an invoice — the figure
 * now lives on that certificate and the correction belongs on the next one.
 * Progress recorded on the months that stay is carried across by the backend.
 */
export function useRemoveBillingMonth(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ period, lines }: { period: string; lines: StageScheduleOfValue[] }) => {
      const affected = new Set(lines.filter((line) => line.period === period).map((l) => l.stageId));
      for (const stageId of affected) {
        const kept = lines
          .filter((line) => line.stageId === stageId && line.period !== period)
          .map((line) => ({ period: line.period, percent: line.percent, billed: line.billed }));
        await stagesApi.replaceScheduleOfValues(projectId, stageId, kept);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}

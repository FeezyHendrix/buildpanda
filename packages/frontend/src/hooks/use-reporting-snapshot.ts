import { useQuery } from "@tanstack/react-query";
import { reportingKeys } from "./query-keys";
import { reportingSnapshotApi } from "@/api/reporting-snapshot";
import { useProjectAccess } from "./use-participants";
import type {
  BudgetCategoryPoint,
  CashFlowPoint,
  InvoiceAgingBuckets,
  HealthPoint,
  PhaseRef,
  ProjectReportingSnapshot,
} from "@/api/reporting-snapshot";

export type {
  BudgetCategoryPoint,
  CashFlowPoint,
  InvoiceAgingBuckets,
  HealthPoint,
  PhaseRef,
  ProjectReportingSnapshot,
};

export function useReportingSnapshot(projectId: string | undefined) {
  const access = useProjectAccess(projectId);
  const allowed = access.data?.capabilities.canViewReporting === true && !access.isError;
  const query = useQuery({
    queryKey: reportingKeys.snapshot(projectId ?? "__none__"),
    queryFn: () => {
      if (!allowed) throw new Error("This report is not available with your current permissions.");
      return reportingSnapshotApi.getSnapshot(projectId!);
    },
    enabled: Boolean(projectId) && allowed,
    staleTime: 60_000,
  });
  return { ...query, data: allowed ? query.data : undefined, isPending: allowed && query.isPending, isLoading: allowed && query.isLoading };
}

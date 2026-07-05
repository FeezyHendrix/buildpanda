import { useQuery } from "@tanstack/react-query";
import { reportingKeys } from "./query-keys";
import { reportingSnapshotApi } from "@/api/reporting-snapshot";
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
  return useQuery({
    queryKey: reportingKeys.snapshot(projectId ?? "__none__"),
    queryFn: () => reportingSnapshotApi.getSnapshot(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
}

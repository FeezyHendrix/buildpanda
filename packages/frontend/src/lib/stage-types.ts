import type { StageStatus } from "./project-types";

export interface Stage {
  id: string;
  projectId: string;
  /** The building phase the stage is grouped under on the Stages page; null until assigned. */
  buildingPhaseId?: string | null;
  name: string;
  status: StageStatus;
  startDate: string | null;
  endDate: string | null;
  dateRange: string | null;
  progressPercent: number;
  value: number;
  sortOrder: number;
  /** Contract (main or change order) that prices this phase; null until assigned. */
  contractId?: string | null;
  /** Estimated figures a PM types on the Phases tab; costs are read from expenses and POs. */
  expectedCost?: number | null;
  estimatedLaborHours?: number | null;
  laborBudget?: number | null;
  materialBudget?: number | null;
  usedLaborHours?: number | null;
  usedMaterialCost?: number | null;
  totalCost?: number | null;
}

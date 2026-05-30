import type { RiskLevel } from "../projects/types.ts";

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  severity: RiskLevel;
}

export interface RiskFactorRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: RiskLevel;
  created_at: Date | string;
}

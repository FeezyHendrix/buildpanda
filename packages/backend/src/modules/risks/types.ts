import type { RiskLevel } from "../projects/types.ts";

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string | null;
  severity: RiskLevel;
}

export interface RiskFactorRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  description_html: string | null;
  severity: RiskLevel;
  created_at: Date | string;
}

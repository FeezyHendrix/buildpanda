import type { RiskLevel, Tone } from "../projects/types.ts";
import type { MediaItem, MediaType, Person } from "../updates/types.ts";

export type InspectionStatus = "Action Required" | "Completed" | "Scheduled";
export type InspectionCategory =
  | "Structural"
  | "Quantity Survey"
  | "General Progress"
  | "Electrical"
  | "Plumbing";

export interface InspectionReport {
  id: string;
  projectId: string;
  inspector: Person;
  title: string;
  category: InspectionCategory;
  description: string;
  status: InspectionStatus;
  riskLevel: RiskLevel;
  scheduledAt: string;
  media: MediaItem[];
  reportUrl?: string;
}

export interface InspectionRow {
  id: string;
  project_id: string;
  inspector_id: string;
  inspector_name: string;
  inspector_role: string;
  inspector_initials_tone: Tone;
  inspector_avatar_url: string | null;
  title: string;
  category: InspectionCategory;
  description: string;
  status: InspectionStatus;
  risk_level: RiskLevel;
  scheduled_at: string;
  report_url: string | null;
  created_at: Date | string;
}

export interface InspectionMediaRow {
  id: string;
  inspection_id: string;
  type: MediaType;
  url: string;
  sort_order: number;
}

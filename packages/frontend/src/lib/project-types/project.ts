import type { StageStatus } from "./decisions";
import type { ProjectStatus, RiskLevel, Currency, ProjectPhase, Tone, MediaType, UpdateStatus, DocumentStatus, InspectionStatus, ServiceStatus, InspectionOutcome, RequesterSide } from "./common";

export interface MyProjectCard {
  id: string;
  name: string;
  address: string | null;
  status: string;
  health_score: number | null;
  risk: string | null;
  progress_percent: number | null;
  budget_total: number | null;
  budget_used: number | null;
  currency: string;
  folder_tone: string | null;
  updated_at: string;
}

export interface Stage {
  id: string;
  projectId: string;
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

export interface Project {
  id: string;
  ownerId: string | null;
  name: string;
  address: string;
  status: ProjectStatus;
  healthScore: number;
  risk: RiskLevel;
  progressPercent: number;
  budgetTotal: number;
  budgetUsed: number;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: Currency;
  pendingApprovals: number;
  nextInspection: { type: string; date: string };
  folderTone: "orange" | "brand" | "green" | "purple";
  updatedAt: string;
  createdAt: string;
  timeline: ProjectPhase[];
}

export interface Person {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  initialsTone?: Tone;
}

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
}

export interface UpdateAction {
  status: UpdateStatus;
  takenAt: string | null;
  takenBy: { id: string; name: string } | null;
}

export type { ProjectUpdate } from "@/api/update-types";

export interface UpdateComment {
  id: string;
  updateId: string;
  author: { id: string; name: string };
  body: string;
  createdAt: string;
}

export type CategoryGroup = "document" | "plan" | "media";

export interface DocumentCategory {
  id: string;
  name: string;
  fileCount: number;
  totalSize: string;
  tone: Tone;
  group: CategoryGroup;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  fileName: string;
  size: string;
  category: string;
  categoryId: string | null;
  group: CategoryGroup;
  uploadedAt: string;
  status: DocumentStatus;
  versionNo: number;
  versionCount: number;
  currentVersionId: string | null;
  title: string | null;
  revision: string | null;
  supersedesId: string | null;
  visibility: DocumentVisibility;
  documentDate: string | null;
}

/** Internal to the delivery team, or issued to the client. */
export const DOCUMENT_VISIBILITIES = ["internal", "shared"] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNo: number;
  revisionLabel: string | null;
  fileName: string;
  size: string;
  notes: string | null;
  uploadedById: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface InspectionReport {
  id: string;
  projectId: string;
  inspector: Person;
  /** The BuildPanda inspector's user id — null until BuildPanda assigns one. */
  inspectorUserId: string | null;
  title: string;
  /** A name from the project's category list, not a fixed union. */
  category: string;
  description: string;
  status: InspectionStatus;
  serviceStatus: ServiceStatus;
  riskLevel: RiskLevel;
  scheduledAt: string;
  activityId: string | null;
  location: string | null;
  holdPoint: boolean;
  outcome: InspectionOutcome | null;
  findings: string | null;
  reinspectionDate: string | null;
  inspectedAt: string | null;
  inspectedByName: string | null;
  requestedById: string | null;
  requestedBySide: RequesterSide;
  /** The party being inspected. The contractor is the subject, never the author. */
  contractorName: string | null;
  reportIssuedAt: string | null;
  /** Recorded, never charged — money is logged, not transacted. */
  feeAmount: number | null;
  feeCurrency: string | null;
  media: MediaItem[];
  reportUrl?: string;
}

export interface BudgetPhase {
  id: string;
  name: string;
  planned: number;
  actual: number;
}

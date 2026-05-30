export type RiskLevel = "Low" | "Medium" | "High";
export type ProjectStatus = "On Track" | "At Risk" | "Delayed";
export type PhaseStatus = "Done" | "InProgress" | "Pending";
export type Currency = "NGN" | "USD";
export type Tone =
  | "brand"
  | "orange"
  | "green"
  | "purple"
  | "amber"
  | "red"
  | "gray";

export type UpdateCategory =
  | "Progress"
  | "Material Delivery"
  | "Inspections"
  | "Issues";
export type UpdateStatus =
  | "Open"
  | "Approved"
  | "Inspected"
  | "Resolved"
  | "Escalated";

export type MediaType = "photo" | "video";
export type DocumentStatus = "Verified" | "Pending" | "Expired";
export type InspectionStatus = "Action Required" | "Completed" | "Scheduled";
export type MilestoneStatus = "Completed" | "InProgress" | "Pending";
export type SignOffStatus = "Verified" | "Scheduled" | "Pending";
export type LedgerType = "Release" | "Deposit" | "Hold";
export type DisputeStatus = "Open" | "Resolved" | "Withdrawn";
export type ActivityStatus =
  | "Planned"
  | "InProgress"
  | "Completed"
  | "Cancelled";
export type WeatherCondition =
  | "Sunny"
  | "Cloudy"
  | "Rain"
  | "Storm"
  | "Fog"
  | "ExtremeHeat";
export type InspectionCategory =
  | "All Reports"
  | "Structural"
  | "Quantity Survey"
  | "General Progress"
  | "Electrical"
  | "Plumbing";
export type NotificationType =
  | "update_posted"
  | "update_action_required"
  | "inspection_scheduled"
  | "milestone_released"
  | "milestone_disputed"
  | "document_uploaded";

export interface ProjectPhase {
  id: string;
  name: string;
  status: PhaseStatus;
  dateRange: string;
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

export interface ProjectUpdate {
  id: string;
  projectId: string;
  activityId: string | null;
  author: Person;
  category: UpdateCategory;
  title: string;
  description: string;
  media: MediaItem[];
  cta: { label: string; tone: "primary" | "secondary" };
  secondaryAction?: { label: string };
  status: UpdateStatus;
  action: UpdateAction;
  createdAt: string;
}

export interface UpdateComment {
  id: string;
  updateId: string;
  author: { id: string; name: string };
  body: string;
  createdAt: string;
}

export interface DocumentCategory {
  id: string;
  name: string;
  fileCount: number;
  totalSize: string;
  tone: Tone;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  fileName: string;
  size: string;
  category: string;
  uploadedAt: string;
  status: DocumentStatus;
}

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

export interface BudgetPhase {
  id: string;
  name: string;
  planned: number;
  actual: number;
}

export interface MaterialProcurement {
  id: string;
  name: string;
  purchasedAt: string;
  receipt: string;
  amount: number;
  thumbnailTone: Tone;
}

export interface MilestonePayment {
  id: string;
  name: string;
  phase: string;
  status: MilestoneStatus;
  percentComplete: number;
  amount: number;
  proof: { fileName: string; verified: boolean } | null;
  inspectorSignOff: SignOffStatus;
}

export interface PaymentLedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: LedgerType;
}

export interface ProjectFinances {
  projectId: string;
  currency: Currency;
  totalBudget: number;
  fundsDeposited: number;
  fundsReleased: number;
  lockedInEscrow: number;
  remainingBalance: number;
  budgetAllocation: BudgetPhase[];
  materialsProcured: MaterialProcurement[];
  milestones: MilestonePayment[];
  ledger: PaymentLedgerEntry[];
}

export interface MilestoneDispute {
  id: string;
  milestoneId: string;
  raisedBy: { id: string; name: string };
  reason: string;
  status: DisputeStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  severity: RiskLevel;
}

export interface ActivityDelay {
  id: string;
  activityId: string;
  reasonCode: string;
  reasonName: string;
  reasonCategory: string;
  description: string | null;
  startedAt: string;
  resolvedAt: string | null;
  costImpact: number;
  currency: Currency;
  preventionNotes: string | null;
  recordedBy: { id: string; name: string | null } | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  projectId: string;
  phaseId: string | null;
  phaseName: string | null;
  name: string;
  activityType: string;
  location: string | null;
  status: ActivityStatus;
  isDelayed: boolean;
  plannedStartAt: string;
  plannedEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  workerCountPlanned: number;
  notes: string | null;
  delays: ActivityDelay[];
  createdAt: string;
  updatedAt: string;
}

export interface DelayReason {
  code: string;
  category: string;
  name: string;
  description: string;
  is_active?: boolean;
}

export interface DailyLogActivityLink {
  activityId: string;
  activityName: string;
  hoursLogged: number;
}

export interface DailyLog {
  projectId: string;
  logDate: string;
  weatherCondition: WeatherCondition | null;
  temperatureC: number | null;
  precipitationMm: number | null;
  windKph: number | null;
  workersExpected: number;
  workersPresent: number;
  totalHours: number;
  summary: string | null;
  activities: DailyLogActivityLink[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  projectId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  notifications: Notification[];
  unreadCount: number;
}

export interface SearchProjectHit {
  id: string;
  name: string;
  address: string;
  snippet: string;
}

export interface SearchUpdateHit {
  id: string;
  projectId: string;
  title: string;
  snippet: string;
  category: string;
}

export interface SearchDocumentHit {
  id: string;
  projectId: string;
  fileName: string;
  category: string;
}

export interface SearchInspectionHit {
  id: string;
  projectId: string;
  title: string;
  snippet: string;
  category: string;
}

export interface SearchResults {
  query: string;
  projects: SearchProjectHit[];
  updates: SearchUpdateHit[];
  documents: SearchDocumentHit[];
  inspections: SearchInspectionHit[];
}

export interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

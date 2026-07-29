import type { CurrencyCode } from "./currency";

export type RiskLevel = "Low" | "Medium" | "High";
export type ProjectStatus = "On Track" | "At Risk" | "Delayed";
export type PhaseStatus = "Done" | "InProgress" | "Pending";
export type Currency = CurrencyCode;
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
  | "document_uploaded"
  | "action_item_due"
  | "action_item_assigned";

export interface ProjectPhase {
  id: string;
  name: string;
  status: PhaseStatus;
  dateRange: string;
}

export type ActionStatus = "Open" | "InProgress" | "Blocked" | "Resolved";
export type ActionPriority = "Low" | "Medium" | "High" | "Urgent";
export type RecurrenceUnit = "day" | "week" | "month";

export interface ActionItem {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  recurrenceUnit: RecurrenceUnit | null;
  recurrenceInterval: number | null;
  recurrenceUntil: string | null;
  recurrenceParentId: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionComment {
  id: string;
  actionItemId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ActionItemDetail extends ActionItem {
  comments: ActionComment[];
}

export type QueryStatus = "Open" | "Answered" | "Closed";

export interface SiteQuery {
  id: string;
  projectId: string;
  subject: string;
  question: string;
  status: QueryStatus;
  answer: string | null;
  dueDate: string | null;
  askedById: string | null;
  answeredById: string | null;
  answeredByName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  answeredAt: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiteQueryComment {
  id: string;
  queryId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SiteQueryDetail extends SiteQuery {
  comments: SiteQueryComment[];
}

export type RfiStatus = "Draft" | "Open" | "InReview" | "Answered" | "Closed" | "Void";
export type RfiPriority = "Low" | "Normal" | "High";

export interface Rfi {
  id: string;
  projectId: string;
  number: number;
  subject: string;
  question: string;
  status: RfiStatus;
  priority: RfiPriority;
  visibility: "internal" | "shared";
  ballInCourtId: string | null;
  ballInCourtName: string | null;
  ballInCourtEmail: string | null;
  assigneeRole: string | null;
  dueDate: string | null;
  officialResponse: string | null;
  officialRespondedById: string | null;
  officialRespondedByName: string | null;
  officialRespondedAt: string | null;
  costImpact: boolean;
  scheduleImpact: boolean;
  changeRequestId: string | null;
  reopenedCount: number;
  createdById: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RfiComment {
  id: string;
  rfiId: string;
  authorId: string;
  authorName: string;
  body: string;
  contentHtml: string | null;
  attachments: { fileId: string; url: string; name: string }[];
  references: { type: "action_item" | "activity"; id: string; label: string }[];
  isProposedResponse: boolean;
  createdAt: string;
}

export interface RfiEvent {
  id: string;
  rfiId: string;
  type: string;
  actorId: string | null;
  actorLabel: string | null;
  detail: unknown;
  createdAt: string;
}

export interface RfiDetail extends Rfi {
  comments: RfiComment[];
  events: RfiEvent[];
}

export type BimVersionStatus = "Processing" | "Ready" | "Failed";

export interface BimModel {
  id: string;
  projectId: string;
  name: string;
  discipline: string | null;
  currentVersionId: string | null;
  status: BimVersionStatus | null;
  elementCount: number | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BimIssueStatus = "Open" | "Closed";

export interface BimCoordinationIssue {
  id: string;
  bimModelId: string;
  elementGuid: string | null;
  position: unknown;
  title: string;
  description: string | null;
  status: BimIssueStatus;
  rfiId: string | null;
  assigneeId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BimUploadTicket =
  | { mode: "single"; storagePath: string; url: string }
  | {
      mode: "multipart";
      storagePath: string;
      uploadId: string;
      partSize: number;
      parts: { partNumber: number; url: string }[];
    };

export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Resubmit";

export interface Approval {
  id: string;
  projectId: string;
  title: string;
  category: string | null;
  description: string | null;
  status: ApprovalStatus;
  response: string | null;
  dueDate: string | null;
  submittedById: string | null;
  requestedReviewerId: string | null;
  requestedReviewerName: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalComment {
  id: string;
  approvalId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ApprovalDetail extends Approval {
  comments: ApprovalComment[];
}

export type SelectionStatus = "open" | "decided" | "cancelled";

export interface SelectionOption {
  id: string;
  selectionId: string;
  name: string;
  description: string | null;
  price: number | null;
  sortOrder: number;
}

export interface Selection {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string | null;
  allowanceAmount: number | null;
  currency: string;
  dueDate: string | null;
  status: SelectionStatus;
  chosenOptionId: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  changeRequestId: string | null;
  createdById: string | null;
  /** Chosen option price minus allowance when both are present (min 0). */
  overage: number | null;
  options: SelectionOption[];
  createdAt: string;
  updatedAt: string;
}

export type ChangeStatus = "Draft" | "Submitted" | "Approved" | "Rejected";

export interface ChangeRequest {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  reason: string | null;
  status: ChangeStatus;
  costImpact: number;
  timeImpactDays: number;
  currency: "NGN" | "USD";
  submittedById: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  decidedAt: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeComment {
  id: string;
  changeRequestId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ChangeRequestDetail extends ChangeRequest {
  comments: ChangeComment[];
}

export type PermitStatus = "NotStarted" | "Applied" | "Approved" | "Rejected" | "Expired";

export type PermitUrgency = "expired" | "expiringSoon" | "active" | "none";

export interface Permit {
  id: string;
  projectId: string;
  title: string;
  authority: string | null;
  referenceNo: string | null;
  status: PermitStatus;
  appliedDate: string | null;
  approvedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  urgency: PermitUrgency;
  daysUntilExpiry: number | null;
  createdAt: string;
  updatedAt: string;
}

export type KeyDateStatus = "Upcoming" | "Met" | "Missed";

export interface KeyDate {
  id: string;
  projectId: string;
  label: string;
  targetDate: string | null;
  actualDate: string | null;
  status: KeyDateStatus;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInsights {
  progress: { stagesTotal: number; stagesComplete: number; overallPercent: number };
  openItems: { actionItems: number; blocked: number; queries: number; awaitingApproval: number };
  budget: { currency: string; total: number; released: number; remaining: number; approvedChangeCost: number };
  scheduleRisk: { approvedChangeDays: number; permitsAtRisk: number; missedKeyDates: number; blockedItems: number };
}

export interface GlobalWhatsNextItem {
  id: string;
  project_id: string;
  projectName: string;
}

export interface GlobalWhatsNext {
  windowDays: number;
  from: string;
  to: string;
  dueActionItems: (GlobalWhatsNextItem & { title: string; priority: string; due_date: string; status: string })[];
  dueQueries: (GlobalWhatsNextItem & { subject: string; due_date: string })[];
  dueApprovals: (GlobalWhatsNextItem & { title: string; due_date: string; status: string })[];
  upcomingKeyDates: (GlobalWhatsNextItem & { label: string; target_date: string })[];
  expiringPermits: (GlobalWhatsNextItem & { title: string; expiry_date: string })[];
}

export interface WhatsNext {
  windowDays: number;
  from: string;
  to: string;
  stagesInProgress: Array<{ id: string; name: string; progress_percent: number; date_range: string | null }>;
  upcomingStages: Array<{ id: string; name: string; start_date: string }>;
  dueActionItems: Array<{ id: string; title: string; priority: string; due_date: string; status: string }>;
  dueQueries: Array<{ id: string; subject: string; due_date: string }>;
  dueApprovals: Array<{ id: string; title: string; due_date: string; status: string }>;
  upcomingKeyDates: Array<{ id: string; label: string; target_date: string }>;
  expiringPermits: Array<{ id: string; title: string; expiry_date: string }>;
}

export type StageStatus = PhaseStatus;

export type KnownParticipantRole =
  | "client"
  | "project_manager"
  | "architect"
  | "inspector"
  | "guest"
  | "materials_requester"
  | "materials_approver";
export type ParticipantRole = KnownParticipantRole | (string & {});
export type ParticipantStatus = "invited" | "active" | "revoked";
export type SectionPermission = "hidden" | "view" | "edit";
export type ParticipantPermissions = Record<string, SectionPermission>;

export interface ProjectParticipant {
  id: string;
  projectId: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: ParticipantRole | "owner";
  status: ParticipantStatus;
  permissions: ParticipantPermissions;
  grants: Record<string, string[]> | null;
  createdAt: string;
}

export interface ProjectAccess {
  relationship: "company" | ParticipantRole | "none";
  orgRole: string | null;
  /** Effective resource permissions (org role ∪ participant overlay), e.g. { finances: ["view"] }. */
  permissions: Record<string, string[]>;
  /**
   * Per-participant page-access matrix (dotted section key -> hidden|view|edit),
   * or null when the participant has no explicit matrix (falls back to role
   * defaults). When present it is the source of truth for per-page visibility.
   */
  sections: Record<string, "hidden" | "view" | "edit"> | null;
  capabilities: {
    canManage: boolean;
    canViewAll: boolean;
    canManageParticipants: boolean;
    canDecideApprovals: boolean;
    canDecideSelections: boolean;
    canRaiseQueries: boolean;
    canComment: boolean;
  };
}

/**
 * Whether a nav entry / page is visible. The effective RBAC map
 * (`access.permissions`) is the single source of truth: the backend already
 * folds org role, participant role defaults and the per-participant section
 * matrix (including `hidden` revocation) into it, so visibility here matches
 * exactly what the API authorizes. Entries without a resource are unrestricted.
 * Presentation only — backend enforces regardless.
 */
export function canViewSection(
  access: ProjectAccess | undefined,
  _sectionKey: string | undefined,
  resource?: string,
): boolean {
  return canViewResource(access, resource);
}

/**
 * Whether the caller may view a permissioned resource. Entries without a
 * resource are unrestricted; while access is still loading we show the entry
 * (the backend enforces regardless — this only drives presentation).
 */
export function canViewResource(
  access: ProjectAccess | undefined,
  resource?: string,
): boolean {
  if (!resource || !access) return true;
  return (access.permissions?.[resource] ?? []).includes("view");
}

/**
 * Whether the caller may perform an action on a resource. `manage` implies
 * every other action on the same resource (mirrors the backend guards).
 * Presentation only — the backend enforces regardless.
 */
export function canResourceAction(
  access: ProjectAccess | undefined,
  resource: string,
  action: string,
): boolean {
  if (!access) return true;
  const actions = access.permissions?.[resource] ?? [];
  return actions.includes(action) || actions.includes("manage");
}

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
  sortOrder: number;
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
  isDraft: boolean;
  generatedKind: string | null;
  createdAt: string;
}

export interface UpdateComment {
  id: string;
  updateId: string;
  author: { id: string; name: string };
  body: string;
  createdAt: string;
}

export type CategoryGroup = "document" | "plan";

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
}

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

export type MaterialOrderStatus =
  | "Draft"
  | "Requested"
  | "Approved"
  | "Ordered"
  | "PartiallyDelivered"
  | "Delivered"
  | "Cancelled";
export type EquipmentRequestStatus =
  | "Draft"
  | "Requested"
  | "Approved"
  | "Scheduled"
  | "OnHire"
  | "Returned"
  | "Cancelled";
export type RequestPriority = "Low" | "Normal" | "High" | "Critical";
export type EquipmentBucket = "requests" | "approvals" | "schedule" | "on-hire" | "returns";

export interface LifecycleLinks {
  phaseId: string | null;
  phaseName: string | null;
  activityId: string | null;
  activityName: string | null;
  documentId: string | null;
  documentName: string | null;
}

export interface MaterialOrder extends LifecycleLinks {
  id: string;
  projectId: string;
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier: string | null;
  status: MaterialOrderStatus;
  priority: RequestPriority;
  neededBy: string;
  orderedAt: string | null;
  expectedDeliveryAt: string | null;
  deliveredAt: string | null;
  estimatedCost: number;
  actualCost: number;
  currency: Currency;
  deliveryLocation: string | null;
  notes: string | null;
  requestedById: string | null;
  procurementId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentRequest extends LifecycleLinks {
  id: string;
  projectId: string;
  title: string;
  equipmentName: string;
  equipmentType: string;
  quantity: number;
  supplier: string | null;
  status: EquipmentRequestStatus;
  bucket: EquipmentBucket;
  priority: RequestPriority;
  neededFrom: string;
  neededUntil: string;
  mobilizedAt: string | null;
  returnedAt: string | null;
  estimatedCost: number;
  actualCost: number;
  currency: Currency;
  deliveryLocation: string | null;
  operatorRequired: boolean;
  notes: string | null;
  requestedById: string | null;
  createdAt: string;
  updatedAt: string;
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

export type CashFlowCategory = "valuation" | "milestone_payment" | "claims_payment";

export interface CashFlowEntry {
  id: string;
  projectId: string;
  category: CashFlowCategory;
  amount: number;
  isCredit: boolean;
  description: string | null;
  entryDate: string;
  createdBy: { id: string | null; name: string } | null;
  createdAt: string;
  retentionAccrued: number;
}

export interface ProjectFinances {
  projectId: string;
  currency: Currency;
  totalBudget: number;
  contractSum: number;
  variationsTotal: number;
  adjustedContract: number;
  certifiedGrossToDate: number;
  amountPaidToDate: number;
  contractTerms: ContractTerms;
  budgetAllocation: BudgetPhase[];
  materialsProcured: MaterialProcurement[];
  milestones: MilestonePayment[];
  ledger: PaymentLedgerEntry[];
}

export type FinanceEventType =
  | "deposit"
  | "milestone_released"
  | "milestone_created"
  | "milestone_updated"
  | "milestone_deleted"
  | "dispute_raised"
  | "cash_flow_entry";

export interface FinanceEvent {
  id: string;
  type: FinanceEventType;
  actor: { id: string | null; name: string };
  summary: string;
  amount: number | null;
  entityId: string | null;
  createdAt: string;
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

// ── Payment methods / contract settings ──────────────────────────────────

export type PaymentModel = "lump_sum" | "remeasurement" | "cost_plus" | "project_finance";

export interface PaymentSettings {
  paymentModels: PaymentModel[];
  mobilizationAdvance: number;
  mobilizationOutstanding: number;
  mobilizationAmortType: "percent" | "fixed" | null;
  mobilizationAmortValue: number;
  retentionHeld: number;
  retentionReleasedPc: number;
  retentionReleasedDl: number;
  retentionRate: number;
}

export interface RetentionRelease {
  id: string;
  projectId: string;
  stage: number;
  amount: number;
  status: "Pending" | "Released" | "Disputed";
  releasedAt: string | null;
  releasedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AdvanceAmortization {
  id: string;
  projectId: string;
  milestoneId: string | null;
  amount: number;
  recoveredAt: string;
}

export interface MeasuredWorkRecord {
  id: string;
  projectId: string;
  milestoneId: string | null;
  description: string;
  unit: string;
  quantity: number;
  unitRate: number;
  amount: number;
  periodStart: string | null;
  periodEnd: string | null;
  certifiedBy: string | null;
  certifiedAt: string | null;
  status: "Draft" | "Certified" | "Invoiced";
  createdAt: string;
}

export interface FinalAccount {
  id: string;
  projectId: string;
  status: "Draft" | "Submitted" | "Agreed" | "Disputed" | "Settled";
  totalContract: number;
  variationsTotal: number;
  claimsTotal: number;
  retentionTotal: number;
  advanceRecovered: number;
  amountPaid: number;
  netSettlement: number;
  agreedAt: string | null;
  agreedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string | null;
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

export type ActivityDependencyType = "FS" | "SS" | "FF" | "SF";

export interface ActivityDependency {
  activityId: string;
  type: ActivityDependencyType;
  lagDays: number;
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
  isSummary: boolean;
  isDelayed: boolean;
  plannedStartAt: string;
  plannedEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  workerCountPlanned: number;
  assigneeId: string | null;
  assigneeName: string | null;
  notes: string | null;
  wbsCode: string | null;
  outlineLevel: number | null;
  parentActivityId: string | null;
  predecessors: ActivityDependency[];
  percentComplete: number;
  durationDays: number | null;
  baselineStartAt: string | null;
  baselineEndAt: string | null;
  isMilestone: boolean;
  source: string;
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
  summaryHtml: string | null;
  activities: DailyLogActivityLink[];
  voidedAt: string | null;
  voidedById: string | null;
  voidedByName: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogEntryVoid {
  id: string;
  reason: string;
  voidedById: string | null;
  voidedByName: string;
  voidedAt: string;
}

export interface DailyLogEntry {
  id: string;
  projectId: string;
  logDate: string;
  authorId: string | null;
  authorName: string;
  authorRole: string;
  bodyHtml: string | null;
  bodyText: string | null;
  voids: DailyLogEntryVoid[];
  voided: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogDay {
  projectId: string;
  logDate: string;
  weatherCondition: WeatherCondition | null;
  temperatureC: number | null;
  precipitationMm: number | null;
  windKph: number | null;
  workersExpected: number;
  workersPresent: number;
  totalHours: number;
  activities: DailyLogActivityLink[];
  entries: DailyLogEntry[];
}

export type ReportPeriod = "weekly" | "monthly" | "quarterly" | "semiAnnual" | "annual";

export const REPORT_PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiAnnual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
];

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

export interface NotificationPreference {
  type: NotificationType;
  label: string;
  group: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
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

export type ChannelType = "project" | "org" | "dm" | "group_dm";
export type NotifyLevel = "all" | "mentions" | "none";

export interface Channel {
  id: string;
  type: ChannelType;
  name: string | null;
  topic: string | null;
  projectId: string | null;
  organizationId: string | null;
  isPrivate: boolean;
  archivedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  muted: boolean;
  notifyLevel: NotifyLevel;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  contentHtml: string | null;
  parentMessageId: string | null;
  quotedMessageId: string | null;
  quotedMessage?: {
    id: string;
    authorName: string | null;
    body: string;
    deleted: boolean;
  } | null;
  references: { type: string; id: string; label: string }[];
  resolvedReferences?: {
    type: string;
    id: string;
    restricted: boolean;
    title?: string;
    status?: string | null;
    projectId?: string | null;
    url?: string;
  }[];
  mentions: { kind: "user" | "here" | "channel"; userId?: string }[];
  attachments: { fileId: string; url: string; name: string; mime?: string; size?: number }[];
  reactions?: { emoji: string; count: number; mine: boolean }[];
  replyCount?: number;
  readAt?: string | null;
  readBy?: number;
  recipientCount?: number;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface ChannelMemberLite {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "member";
}

export type TaskStatus = "Todo" | "Doing" | "Done";

export interface TaskColumn {
  id: string;
  boardId: string;
  name: string;
  status: string | null;
  position: number;
}

export interface Task {
  id: string;
  projectId: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  assigneeId: string | null;
  assigneeTeamMemberId: string | null;
  assigneeName: string | null;
  assignees: TaskAssignee[];
  dueDate: string | null;
  priority: TaskPriority;
  labels: string[];
  position: number;
  sourceType: string | null;
  sourceId: string | null;
  createdById: string | null;
  createdByName: string | null;
  subtaskTotal: number;
  subtaskDone: number;
  entityLinkTypes: TaskEntityType[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  kind: "user" | "team";
  id: string;
  name: string;
}

export type TaskPriority = "Low" | "Medium" | "High";

export interface AssignableUser {
  kind: "user" | "team";
  id: string;
  name: string;
  email: string | null;
  isSelf: boolean;
}

export type TaskLinkType = "relates_to" | "blocks" | "blocked_by" | "duplicates";

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
}

export interface TaskLink {
  id: string;
  linkType: TaskLinkType;
  targetTaskId: string;
  targetTaskTitle: string;
}

export const TASK_ENTITY_TYPES = [
  "action_item",
  "rfi",
  "change_request",
  "material",
  "invoice",
  "milestone_payment",
] as const;
export type TaskEntityType = (typeof TASK_ENTITY_TYPES)[number];

export interface TaskEntityLink {
  id: string;
  entityType: TaskEntityType;
  entityId: string;
  label: string;
  status: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface TaskDetail extends Task {
  subtasks: Subtask[];
  links: TaskLink[];
  entityLinks: TaskEntityLink[];
  comments: TaskComment[];
}

export interface TaskBoard {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  scope: "all" | "assigned";
  columns: TaskColumn[];
  tasks: Task[];
}

export type LedgerEntryType = "IN" | "USED" | "VOID";
export type LedgerEntryStatus = "Posted" | "Voided";

export interface MaterialCatalogItem {
  id: string;
  projectId: string;
  name: string;
  unit: string;
  lowStockThreshold: number | null;
  active: boolean;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  preferredSupplierId: string | null;
  preferredSupplierName: string | null;
  autoReorderEnabled: boolean;
}

export interface ReorderPolicyInput {
  lowStockThreshold?: number | null;
  reorderQuantity?: number | null;
  leadTimeDays?: number | null;
  preferredSupplierId?: string | null;
  autoReorderEnabled?: boolean;
}

export interface LedgerEntryFile {
  fileId: string;
  url: string;
  name: string;
}

export interface LedgerEntry {
  id: string;
  projectId: string;
  entryType: LedgerEntryType;
  status: LedgerEntryStatus;
  materialId: string;
  materialName: string;
  unit: string;
  locationKey: string;
  quantity: number;
  stockDelta: number;
  occurredAt: string;
  timestampSuspect: boolean;
  negativeStock: boolean;
  loggedById: string | null;
  loggedByName: string | null;
  materialOrderId: string | null;
  taskId: string | null;
  activityId: string | null;
  reversalForEntryId: string | null;
  reason: string | null;
  notesHtml: string | null;
  files: LedgerEntryFile[];
  createdAt: string;
}

export interface StockLevel {
  materialId: string;
  materialName: string;
  unit: string;
  locationKey: string;
  onHandQty: number;
  totalReceived: number;
  totalUsed: number;
  lowStockThreshold: number | null;
  lowStock: boolean;
}

export interface Supplier {
  id: string;
  projectId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutoWindowMaterialOrder {
  id: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier: string | null;
  status: MaterialOrderStatus;
  neededBy: string;
}

export interface AutoWindowActivity {
  activityId: string;
  activityName: string;
  phaseName: string | null;
  status: string;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned: number;
  fromProgramme: boolean;
  materialOrders: AutoWindowMaterialOrder[];
  hasMaterialCoverage: boolean;
}

export interface AutoWindowResult {
  weeks: number;
  from: string;
  to: string;
  activities: AutoWindowActivity[];
}

export const LOOK_AHEAD_STATUSES = ["Draft", "UnderReview", "Approved"] as const;
export type LookAheadStatus = (typeof LOOK_AHEAD_STATUSES)[number];
export type LookAheadTimeline = "past" | "current" | "future";

export interface LookAheadActivitySummary {
  activityId: string;
  name: string;
  status: string;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned: number;
}

export interface LookAhead {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: LookAheadStatus;
  startDate: string;
  endDate: string;
  totalWorkers: number | null;
  activities: LookAheadActivitySummary[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLookAheadInput {
  name: string;
  description?: string | null;
  status?: LookAheadStatus;
  startDate: string;
  endDate: string;
  totalWorkers?: number | null;
  activityIds?: string[];
}

export interface UpdateLookAheadInput {
  name?: string;
  description?: string | null;
  status?: LookAheadStatus;
  startDate?: string;
  endDate?: string;
  totalWorkers?: number | null;
  assignActivityIds?: string[];
  unassignActivityIds?: string[];
}

export type TransactionCategoryType = "preset" | "custom";

export interface Transaction {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string;
  categoryLabel: string;
  categoryColor: string | null;
  categoryType: TransactionCategoryType;
  amount: number;
  transactedAt: string;
  vendor: string | null;
  reference: string | null;
  receiptFileId: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionCategoryInfo {
  key: string;
  label: string;
  color: string | null;
  type: TransactionCategoryType;
  categoryId: string | null;
}

export interface TransactionAnalyticsCategory {
  key: string;
  label: string;
  color: string | null;
  type: TransactionCategoryType;
  total: number;
  count: number;
}

export interface TransactionAnalyticsMonth {
  month: string;
  total: number;
}

export interface TransactionAnalytics {
  totalAmount: number;
  count: number;
  byCategory: TransactionAnalyticsCategory[];
  byMonth: TransactionAnalyticsMonth[];
}

export interface TransactionListFilters {
  category?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface CreateTransactionInput {
  title: string;
  description?: string | null;
  category: string;
  amount: number;
  transactedAt: string;
  vendor?: string | null;
  reference?: string | null;
  receiptFileId?: string | null;
}

export interface UpdateTransactionInput {
  title?: string;
  description?: string | null;
  category?: string;
  amount?: number;
  transactedAt?: string;
  vendor?: string | null;
  reference?: string | null;
  receiptFileId?: string | null;
}

export interface CreateCustomCategoryInput {
  label: string;
  color?: string | null;
}

export const CONTRACT_TYPES = [
  "lump_sum",
  "cost_plus",
  "unit_rate",
  "gmp",
  "design_build",
  "target_cost",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const RETENTION_RELEASE_MODES = [
  "all_at_practical_completion",
  "staged_pc_dlp",
  "all_at_dlp",
] as const;
export type RetentionReleaseMode = (typeof RETENTION_RELEASE_MODES)[number];

export const ADVANCE_RECOVERY_MODES = ["percentage", "fixed"] as const;
export type AdvanceRecoveryMode = (typeof ADVANCE_RECOVERY_MODES)[number];

export interface ContractTerms {
  contractType: ContractType;
  retentionRate: number;
  retentionReleaseMode: RetentionReleaseMode;
  advancePercentage: number;
  advanceRecoveryMode: AdvanceRecoveryMode;
  advanceRecoveryRate: number;
  paymentTermsDays: number;
  defectsLiabilityDays: number;
  contractNotes: string | null;
}

export interface UpdateContractTermsInput {
  contractSum?: number;
  contractType?: ContractType;
  retentionRate?: number;
  retentionReleaseMode?: RetentionReleaseMode;
  advancePercentage?: number;
  advanceRecoveryMode?: AdvanceRecoveryMode;
  advanceRecoveryRate?: number;
  paymentTermsDays?: number;
  defectsLiabilityDays?: number;
  contractNotes?: string | null;
}


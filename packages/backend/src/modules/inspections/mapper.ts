import type { MediaItem } from "../updates/types.ts";
import type {
  AdminInspectionRow,
  InspectionMediaRow,
  InspectionReport,
  InspectionRequestSummary,
  InspectionRow,
} from "./types.ts";

export const toIso = (value: Date | string | null): string | null =>
  value ? new Date(value).toISOString() : null;

export const toDateOnly = (value: Date | string | null): string | null =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

/** pg returns numeric as a string; a fee is a recorded figure, not a transaction. */
export const toNumber = (value: string | number | null): number | null =>
  value === null || value === undefined ? null : Number(value);

export function toMedia(row: InspectionMediaRow): MediaItem {
  return { id: row.id, type: row.type, url: row.url };
}

export function toReport(row: InspectionRow, media: InspectionMediaRow[]): InspectionReport {
  const report: InspectionReport = {
    id: row.id,
    projectId: row.project_id,
    inspector: {
      id: row.inspector_id,
      name: row.inspector_name,
      role: row.inspector_role,
      initialsTone: row.inspector_initials_tone,
      ...(row.inspector_avatar_url ? { avatarUrl: row.inspector_avatar_url } : {}),
    },
    inspectorUserId: row.inspector_user_id ?? null,
    title: row.title,
    category: row.category,
    description: row.description,
    descriptionHtml: row.description_html,
    status: row.status,
    serviceStatus: row.service_status,
    riskLevel: row.risk_level,
    scheduledAt: row.scheduled_at,
    activityId: row.activity_id ?? null,
    location: row.location ?? null,
    holdPoint: Boolean(row.hold_point),
    outcome: row.outcome ?? null,
    findings: row.findings ?? null,
    reinspectionDate: toDateOnly(row.reinspection_date ?? null),
    inspectedAt: toIso(row.inspected_at ?? null),
    inspectedByName: row.inspected_by_name ?? null,
    requestedById: row.requested_by_id ?? null,
    requestedBySide: row.requested_by_side,
    contractorName: row.contractor_name ?? null,
    reportIssuedAt: toIso(row.report_issued_at ?? null),
    feeAmount: toNumber(row.fee_amount ?? null),
    feeCurrency: row.fee_currency ?? null,
    media: media.map(toMedia),
  };
  if (row.report_url) report.reportUrl = row.report_url;
  return report;
}

/** The cross-project queue row BuildPanda works through in the admin app. */
export function toRequestSummary(row: AdminInspectionRow): InspectionRequestSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name ?? null,
    organizationId: row.organization_id ?? null,
    organizationName: row.organization_name ?? null,
    title: row.title,
    category: row.category,
    contractorName: row.contractor_name ?? null,
    serviceStatus: row.service_status,
    status: row.status,
    outcome: row.outcome ?? null,
    scheduledAt: row.scheduled_at,
    reportIssuedAt: toIso(row.report_issued_at ?? null),
    requestedById: row.requested_by_id ?? null,
    requestedByName: row.requested_by_name ?? null,
    requestedBySide: row.requested_by_side,
    inspectorUserId: row.inspector_user_id ?? null,
    inspectorName: row.inspector_user_name ?? row.inspector_name ?? null,
    feeAmount: toNumber(row.fee_amount ?? null),
    feeCurrency: row.fee_currency ?? null,
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
  };
}

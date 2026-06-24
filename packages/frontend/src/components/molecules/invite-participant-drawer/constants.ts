import type { KnownParticipantRole, ParticipantPermissions } from "@/lib/project-types";

export const KNOWN_ROLES: KnownParticipantRole[] = ["client", "architect", "inspector", "guest"];

export const ROLE_META: Record<KnownParticipantRole, { label: string; description: string }> = {
  client: {
    label: "Client",
    description:
      "Views progress, raises queries and approves milestone payments. Finance details hidden by default.",
  },
  architect: {
    label: "Architect",
    description:
      "Full document and schedule access. Can create RFIs and respond to workflow items.",
  },
  inspector: {
    label: "Inspector",
    description:
      "Manages inspections and daily logs. View-only access to schedule and documents.",
  },
  guest: {
    label: "Guest",
    description:
      "View-only access to updates, schedule and documents. Cannot take actions.",
  },
};

export type MatrixGroup = { group: string; items: { key: string; label: string }[] };

export const PERMISSION_MATRIX: MatrixGroup[] = [
  {
    group: "Project",
    items: [
      { key: "projects.documents", label: "Documents" },
      { key: "projects.schedule", label: "Schedule & tasks" },
      { key: "projects.bim", label: "BIM viewer" },
    ],
  },
  {
    group: "Quality & risk",
    items: [
      { key: "quality.inspections", label: "Inspections" },
      { key: "quality.dailyLogs", label: "Daily logs" },
      { key: "quality.risks", label: "Risk register" },
    ],
  },
  {
    group: "Commercial",
    items: [
      { key: "commercial.finances", label: "Finances" },
      { key: "commercial.budget", label: "Budget" },
      { key: "commercial.invoices", label: "Invoices" },
      { key: "commercial.materialsEquipment", label: "Materials & equipment" },
      { key: "commercial.materialsLedger", label: "Materials ledger" },
    ],
  },
  {
    group: "Workflow",
    items: [
      { key: "workflow.rfis", label: "RFIs" },
      { key: "workflow.queries", label: "Queries" },
      { key: "workflow.approvals", label: "Approvals" },
      { key: "workflow.changeRequests", label: "Change requests" },
      { key: "workflow.actionItems", label: "Action items" },
    ],
  },
  {
    group: "Compliance",
    items: [
      { key: "compliance.permits", label: "Permits" },
      { key: "compliance.keyDates", label: "Key dates" },
    ],
  },
  {
    group: "Collaboration",
    items: [
      { key: "project.updates", label: "Updates" },
      { key: "collaboration.messaging", label: "Messaging" },
    ],
  },
];

export const ROLE_DEFAULTS: Record<KnownParticipantRole, ParticipantPermissions> = {
  client: {
    "projects.documents": "view",
    "projects.schedule": "view",
    "projects.bim": "hidden",
    "quality.inspections": "hidden",
    "quality.dailyLogs": "hidden",
    "quality.risks": "hidden",
    "commercial.finances": "hidden",
    "commercial.budget": "hidden",
    "commercial.invoices": "hidden",
    "commercial.materialsEquipment": "hidden",
    "commercial.materialsLedger": "hidden",
    "workflow.rfis": "view",
    "workflow.queries": "edit",
    "workflow.approvals": "edit",
    "workflow.changeRequests": "view",
    "workflow.actionItems": "hidden",
    "compliance.permits": "hidden",
    "compliance.keyDates": "view",
    "project.updates": "view",
    "collaboration.messaging": "edit",
  },
  architect: {
    "projects.documents": "edit",
    "projects.schedule": "edit",
    "projects.bim": "edit",
    "quality.inspections": "view",
    "quality.dailyLogs": "view",
    "quality.risks": "view",
    "commercial.finances": "hidden",
    "commercial.budget": "hidden",
    "commercial.invoices": "hidden",
    "commercial.materialsEquipment": "view",
    "commercial.materialsLedger": "hidden",
    "workflow.rfis": "edit",
    "workflow.queries": "edit",
    "workflow.approvals": "view",
    "workflow.changeRequests": "view",
    "workflow.actionItems": "view",
    "compliance.permits": "view",
    "compliance.keyDates": "view",
    "project.updates": "view",
    "collaboration.messaging": "edit",
  },
  inspector: {
    "projects.documents": "view",
    "projects.schedule": "view",
    "projects.bim": "hidden",
    "quality.inspections": "edit",
    "quality.dailyLogs": "edit",
    "quality.risks": "view",
    "commercial.finances": "hidden",
    "commercial.budget": "hidden",
    "commercial.invoices": "hidden",
    "commercial.materialsEquipment": "hidden",
    "commercial.materialsLedger": "hidden",
    "workflow.rfis": "view",
    "workflow.queries": "view",
    "workflow.approvals": "view",
    "workflow.changeRequests": "hidden",
    "workflow.actionItems": "view",
    "compliance.permits": "view",
    "compliance.keyDates": "view",
    "project.updates": "view",
    "collaboration.messaging": "view",
  },
  guest: {
    "projects.documents": "view",
    "projects.schedule": "view",
    "projects.bim": "hidden",
    "quality.inspections": "hidden",
    "quality.dailyLogs": "hidden",
    "quality.risks": "hidden",
    "commercial.finances": "hidden",
    "commercial.budget": "hidden",
    "commercial.invoices": "hidden",
    "commercial.materialsEquipment": "hidden",
    "commercial.materialsLedger": "hidden",
    "workflow.rfis": "hidden",
    "workflow.queries": "hidden",
    "workflow.approvals": "hidden",
    "workflow.changeRequests": "hidden",
    "workflow.actionItems": "hidden",
    "compliance.permits": "hidden",
    "compliance.keyDates": "view",
    "project.updates": "view",
    "collaboration.messaging": "hidden",
  },
};

import type { ComponentType, SVGAttributes } from "react";
import {
  AlertIcon,
  CalendarIcon,
  DocumentsIcon,
  FinancesIcon,
  InspectionsIcon,
  MaterialsIcon,
  MessagesIcon,
  OverviewIcon,
  TrendingUpIcon,
  UpdatesIcon,
} from "@/components/atoms/project-nav-icons";

export type IconComponent = ComponentType<SVGAttributes<SVGSVGElement>>;

export interface NavEntry {
  label: string;
  slug: string;
  Icon: IconComponent | string;
  flag?: string;
}

export interface ProjectNavItem extends NavEntry {
  to: string;
  badge?: number;
}

export interface GroupNavItem extends ProjectNavItem {
  helper: string;
}

export const NAV_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: OverviewIcon },
  {
    label: "Updates",
    slug: "updates",
    Icon: UpdatesIcon,
    flag: "project.updates",
  },
] as const;

export const MATERIALS_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Materials",
    slug: "materials",
    Icon: MaterialsIcon,
    helper: "Orders & requests",
    flag: "commercial.materialsEquipment",
  },
  {
    label: "Material Log",
    slug: "material-log",
    Icon: MaterialsIcon,
    helper: "Stock & audit trail",
    flag: "commercial.materialsLedger",
  },
  {
    label: "Equipment Requests",
    slug: "equipment-requests",
    Icon: MaterialsIcon,
    helper: "Rental workflow",
    flag: "commercial.materialsEquipment",
  },
] as const;

export const SCHEDULE_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Build Stages",
    slug: "schedules/stages",
    Icon: OverviewIcon,
    helper: "Phases & progress",
    flag: "projects.schedule",
  },
  {
    label: "Key Dates",
    slug: "schedules/key-dates",
    Icon: CalendarIcon,
    helper: "Milestone dates",
    flag: "compliance.keyDates",
  },
  {
    label: "Site Activity",
    slug: "schedules/activities",
    Icon: TrendingUpIcon,
    helper: "Work items",
    flag: "projects.schedule",
  },
  {
    label: "Daily Log",
    slug: "schedules/daily-log",
    Icon: CalendarIcon,
    helper: "Field reports",
    flag: "quality.dailyLogs",
  },
  {
    label: "Project Chart",
    slug: "schedules/project-chart",
    Icon: CalendarIcon,
    helper: "Gantt chart",
    flag: "projects.schedule",
  },
] as const;

export const SITE_CONTROL_ENTRIES: readonly (NavEntry & { helper: string })[] =
  [
    {
      label: "Inspections",
      slug: "inspections",
      Icon: InspectionsIcon,
      helper: "Quality checks",
      flag: "quality.inspections",
    },
    {
      label: "Action Items",
      slug: "action-items",
      Icon: TrendingUpIcon,
      helper: "Open blockers",
      flag: "workflow.actionItems",
    },
    {
      label: "Queries",
      slug: "queries",
      Icon: MessagesIcon,
      helper: "Field questions",
      flag: "workflow.queries",
    },
    {
      label: "RFIs",
      slug: "rfis",
      Icon: AlertIcon,
      helper: "Requests for information",
      flag: "workflow.rfis",
    },
    // { label: "BIM Models", slug: "bim", Icon: DocumentsIcon, helper: "3D model viewer" },
    {
      label: "Approvals",
      slug: "approvals",
      Icon: InspectionsIcon,
      helper: "Owner sign-offs",
      flag: "workflow.approvals",
    },
    {
      label: "Change Requests",
      slug: "change-requests",
      Icon: FinancesIcon,
      helper: "Scope changes",
      flag: "workflow.changeRequests",
    },
    {
      label: "Permits",
      slug: "permits",
      Icon: DocumentsIcon,
      helper: "Authority records",
      flag: "compliance.permits",
    },
  ] as const;

export const FINANCE_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Overview",
    slug: "finances",
    Icon: FinancesIcon,
    helper: "Cashflow & escrow",
    flag: "commercial.finances",
  },
  {
    label: "Payment Claims",
    slug: "finances/payment-claims",
    Icon: DocumentsIcon,
    helper: "Drawdowns",
    flag: "commercial.paymentClaims",
  },
  {
    label: "Invoices",
    slug: "finances/invoices",
    Icon: DocumentsIcon,
    helper: "AP / AR",
    flag: "commercial.invoices",
  },
  {
    label: "Purchase Orders",
    slug: "finances/purchase-orders",
    Icon: DocumentsIcon,
    helper: "Committed spend",
    flag: "commercial.purchaseOrders",
  },
] as const;

export const CLIENT_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: OverviewIcon },
  {
    label: "Updates",
    slug: "updates",
    Icon: UpdatesIcon,
    flag: "project.updates",
  },
  {
    label: "Schedules",
    slug: "schedules",
    Icon: CalendarIcon,
    flag: "projects.schedule",
  },
  {
    label: "Queries",
    slug: "queries",
    Icon: MessagesIcon,
    flag: "workflow.queries",
  },
  {
    label: "Finances",
    slug: "finances",
    Icon: FinancesIcon,
    flag: "commercial.finances",
  },
  {
    label: "Documents",
    slug: "documents",
    Icon: DocumentsIcon,
    flag: "projects.documents",
  },
] as const;

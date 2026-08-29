import type { ComponentType, SVGAttributes } from "react";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import {
  AlertIcon,
  BinocularsIcon,
  BlocksIcon,
  ClipboardIcon,
  GanttIcon,
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
  flag?: FeatureFlagKey;
  /** Permission resource from the backend `statement`; shown only with `<resource>:view`. */
  resource?: string;
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
    resource: "updates",
    Icon: UpdatesIcon,
    flag: "project.updates",
  },
] as const;

export const MATERIALS_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Materials",
    slug: "materials",
    resource: "materials",
    Icon: MaterialsIcon,
    helper: "Orders & requests",
    flag: "commercial.materialsEquipment",
  },
  {
    label: "Material Log",
    slug: "material-log",
    resource: "materials",
    Icon: MaterialsIcon,
    helper: "Stock & audit trail",
    flag: "commercial.materialsLedger",
  },
  {
    label: "Equipment Requests",
    slug: "equipment-requests",
    resource: "materials",
    Icon: MaterialsIcon,
    helper: "Rental workflow",
    flag: "commercial.materialsEquipment",
  },
  {
    label: "Suppliers",
    slug: "suppliers",
    resource: "materials",
    Icon: MaterialsIcon,
    helper: "Supplier directory",
    flag: "commercial.materialsEquipment",
  },
] as const;

export const SCHEDULE_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Build Stages",
    slug: "schedules/stages",
    resource: "schedule",
    Icon: BlocksIcon,
    helper: "Phases & progress",
    flag: "projects.schedule",
  },
  {
    label: "Key Dates",
    slug: "schedules/key-dates",
    resource: "schedule",
    Icon: CalendarIcon,
    helper: "Milestone dates",
    flag: "compliance.keyDates",
  },
  {
    label: "Site Activity",
    slug: "schedules/activities",
    resource: "schedule",
    Icon: TrendingUpIcon,
    helper: "Work items",
    flag: "projects.schedule",
  },
  {
    label: "Project Chart",
    slug: "schedules/project-chart",
    resource: "schedule",
    Icon: GanttIcon,
    helper: "Gantt chart",
    flag: "projects.schedule",
  },
] as const;

export const SITE_CONTROL_ENTRIES: readonly (NavEntry & { helper: string })[] =
  [
    {
      label: "Daily Log",
      slug: "schedules/daily-log",
      resource: "dailyLog",
      Icon: ClipboardIcon,
      helper: "Field reports",
      flag: "quality.dailyLogs",
    },
    {
      label: "Look Aheads",
      slug: "look-aheads",
      resource: "schedule",
      Icon: BinocularsIcon,
      helper: "Rolling look-ahead planning",
      flag: "projects.schedule",
    },
    {
      label: "RFIs",
      slug: "rfis",
    resource: "rfis",
      Icon: AlertIcon,
      helper: "Requests for information",
      flag: "workflow.rfis",
    },
    {
      label: "BIM Models",
      slug: "bim",
    resource: "bim",
      Icon: DocumentsIcon,
      helper: "3D model viewer",
      flag: "projects.bim",
    },
    {
      label: "Client Approvals",
      slug: "approvals",
      resource: "approvals",
      Icon: InspectionsIcon,
      helper: "Client sign-offs",
      flag: "workflow.approvals",
    },
    {
      label: "Selections",
      slug: "selections",
      resource: "selections",
      Icon: InspectionsIcon,
      helper: "Client choices & allowances",
      flag: "projects.selections",
    },
    {
      label: "Change Requests",
      slug: "change-requests",
      resource: "change-requests",
      Icon: FinancesIcon,
      helper: "Scope changes",
      flag: "workflow.changeRequests",
    },
    {
      label: "Permits & Compliance",
      slug: "permits",
      resource: "permits",
      Icon: DocumentsIcon,
      helper: "Regulatory permits & expiry",
      flag: "compliance.permits",
    },
  ] as const;

export const FINANCE_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Overview",
    slug: "finances",
    resource: "finances",
    Icon: FinancesIcon,
    helper: "Money position",
    flag: "commercial.finances",
  },
  {
    label: "Contract & Stages",
    slug: "finances/contract-stages",
    resource: "finances",
    Icon: BlocksIcon,
    helper: "Contract value & stage billing",
    flag: "commercial.finances",
  },
  {
    label: "Invoices",
    slug: "finances/invoices",
    resource: "finances",
    Icon: DocumentsIcon,
    helper: "Send & track invoices",
    flag: "commercial.invoices",
  },
  {
    label: "Payments",
    slug: "finances/payments",
    resource: "finances",
    Icon: FinancesIcon,
    helper: "Stage payments & requests",
    flag: "commercial.finances",
  },
  {
    label: "Expenses",
    slug: "finances/transactions",
    resource: "transactions",
    Icon: DocumentsIcon,
    helper: "Site expenses & receipts",
    flag: "commercial.transactions",
  },
  {
    label: "Change Orders",
    slug: "change-requests",
    resource: "change-requests",
    Icon: FinancesIcon,
    helper: "Scope changes",
    flag: "workflow.changeRequests",
  },
] as const;

export const CLIENT_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: OverviewIcon },
  {
    label: "Updates",
    slug: "updates",
    resource: "updates",
    Icon: UpdatesIcon,
    flag: "project.updates",
  },
  {
    label: "Schedules",
    slug: "schedules",
    resource: "schedule",
    Icon: CalendarIcon,
    flag: "projects.schedule",
  },
  {
    label: "Queries",
    slug: "queries",
    resource: "queries",
    Icon: MessagesIcon,
    flag: "workflow.queries",
  },
  {
    label: "Selections",
    slug: "selections",
    resource: "selections",
    Icon: InspectionsIcon,
    flag: "projects.selections",
  },
  {
    label: "Finances",
    slug: "finances",
    resource: "finances",
    Icon: FinancesIcon,
    flag: "commercial.finances",
  },
  {
    label: "Documents",
    slug: "documents",
    resource: "documents",
    Icon: DocumentsIcon,
    flag: "projects.documents",
  },
] as const;

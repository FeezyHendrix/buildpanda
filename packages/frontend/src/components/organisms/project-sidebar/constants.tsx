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
  TrendingUpIcon,
  UpdatesIcon,
} from "@/components/atoms/project-nav-icons";
import { icons2 } from "@/assets/icons2/icon2";

export type IconComponent = ComponentType<SVGAttributes<SVGSVGElement>>;

export interface NavEntry {
  label: string;
  slug: string;
  /** A component renders directly; a string is an icons2 asset src rendered via ReactSVG. */
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

// "Updates" now lives inside the Progress group (see PROGRESS_ENTRIES) rather
// than as a flat top-level item.
export const NAV_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: icons2.overview },
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

// Note: "Site Activity" (schedules/activities) is intentionally not part of
// the current Progress group nav — it isn't in the latest design. The route
// still exists (App.tsx) and the entry is kept here, commented, so it's a
// one-line restore if it comes back.
export const PROGRESS_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Updates",
    slug: "updates",
    resource: "updates",
    Icon: UpdatesIcon,
    helper: "Project update posts",
    flag: "project.updates",
  },
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
  // {
  //   label: "Site Activity",
  //   slug: "schedules/activities",
  //   resource: "schedule",
  //   Icon: TrendingUpIcon,
  //   helper: "Work items",
  //   flag: "projects.schedule",
  // },
  {
    label: "Programme of work",
    slug: "schedules/project-chart",
    resource: "schedule",
    Icon: GanttIcon,
    helper: "Gantt chart",
    flag: "projects.schedule",
  },
] as const;

export const OPERATIONS_ENTRIES: readonly (NavEntry & { helper: string })[] = [
  {
    label: "Tasks",
    slug: "tasks",
    resource: "schedule",
    Icon: TrendingUpIcon,
    helper: "Work item board",
    flag: "projects.schedule",
  },
  {
    label: "Daily Log",
    slug: "schedules/daily-log",
    resource: "dailyLog",
    Icon: ClipboardIcon,
    helper: "Field reports",
    flag: "quality.dailyLogs",
  },
  {
    label: "Look Ahead",
    slug: "look-aheads",
    resource: "schedule",
    Icon: BinocularsIcon,
    helper: "Rolling look-ahead planning",
    flag: "projects.schedule",
  },
] as const;

export const SITE_CONTROL_ENTRIES: readonly (NavEntry & { helper: string })[] =
  [
    {
      label: "RFIs",
      slug: "rfis",
    resource: "rfis",
      Icon: AlertIcon,
      helper: "Requests for information",
      flag: "workflow.rfis",
    },
    {
      label: "BIMs",
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
    helper: "Cashflow & escrow",
    flag: "commercial.finances",
  },
  {
    label: "Contracts",
    slug: "finances/contract",
    resource: "finances",
    Icon: FinancesIcon,
    helper: "Contract settings",
    flag: "commercial.finances",
  },
  {
    label: "Payments",
    slug: "finances/transactions",
    resource: "transactions",
    Icon: DocumentsIcon,
    helper: "Photo-backed expense ledger",
    flag: "commercial.transactions",
  },
  // Not yet routed (no page under finances/*) — restore once built.
  // {
  //   label: "Advance",
  //   slug: "finances/advance",
  //   resource: "finances",
  //   Icon: FinancesIcon,
  //   helper: "Mobilization & recovery",
  //   flag: "commercial.finances",
  // },
  // {
  //   label: "Retention",
  //   slug: "finances/retention",
  //   resource: "finances",
  //   Icon: FinancesIcon,
  //   helper: "Held & staged releases",
  //   flag: "commercial.finances",
  // },
  // {
  //   label: "Measured Work",
  //   slug: "finances/measured-work",
  //   resource: "finances",
  //   Icon: FinancesIcon,
  //   helper: "Unit-rate valuations",
  //   flag: "commercial.finances",
  // },
  {
    label: "Final Account",
    slug: "finances/final-account",
    resource: "finances",
    Icon: FinancesIcon,
    helper: "Contract settlement",
    flag: "commercial.finances",
  },
  {
    label: "Budget",
    slug: "finances/budget",
    resource: "finances",
    Icon: FinancesIcon,
    helper: "Planning & allocation",
    flag: "commercial.budget",
  },
  {
    label: "Milestone Payments",
    slug: "finances/milestone-payments",
    resource: "finances",
    Icon: FinancesIcon,
    helper: "Drawdown schedule",
    flag: "commercial.finances",
  },
  {
    label: "Payment Claims",
    slug: "finances/payment-claims",
    resource: "finances",
    Icon: DocumentsIcon,
    helper: "Drawdowns",
    flag: "commercial.paymentClaims",
  },
  {
    label: "Invoices",
    slug: "finances/invoices",
    resource: "finances",
    Icon: DocumentsIcon,
    helper: "AP / AR",
    flag: "commercial.invoices",
  },
  {
    label: "Purchase Orders",
    slug: "finances/purchase-orders",
    resource: "finances",
    Icon: DocumentsIcon,
    helper: "Committed spend",
    flag: "commercial.purchaseOrders",
  },
] as const;

export const CLIENT_ENTRIES: readonly NavEntry[] = [
  { label: "Overview", slug: "overview", Icon: icons2.grid },
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

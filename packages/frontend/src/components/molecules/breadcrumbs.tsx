import { createContext, useContext, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

const ProjectBreadcrumbNameContext = createContext<string | undefined>(undefined);

function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="text-gray-500 hover:text-gray-900 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "font-semibold text-gray-900"
                      : "text-gray-500"
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRightIcon className="size-3 text-gray-300" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const AUTH_LABELS: Record<string, string> = {
  "sign-up": "Sign up",
  "sign-in": "Sign in",
  "forgot-password": "Forgot password",
  "reset-password": "Reset password",
  "verify-email": "Verify email",
};

const DASHBOARD_LABELS: Record<string, string> = {
  settings: "Settings",
  team: "Team & Roles",
};

const PROJECT_LABELS: Record<string, string> = {
  overview: "Overview",
  updates: "Updates",
  finances: "Finance",
  budget: "Budgeting",
  "budget-allocation": "Budget Allocation",
  invoices: "Invoicing",
  "milestone-payments": "Milestone Payments",
  "panda-ai": "Panda AI",
  materials: "Materials",
  orders: "Orders",
  requests: "Requests",
  "equipment-requests": "Equipment Requests",
  documents: "Documents",
  team: "Team",
  inspections: "Inspections",
  messages: "Messages",
  settings: "Settings",
  activities: "Site Activity",
  milestones: "Milestones",
  "project-chart": "Project Chart",
  schedule: "Schedule",
  stages: "Build Stages",
  "action-items": "Action Items",
  queries: "Queries",
  approvals: "Approvals",
  "change-requests": "Change Requests",
  permits: "Permits",
  "key-dates": "Key Dates",
  "whats-next": "What's Next",
  people: "People",
  "daily-log": "Daily Log",
};

const EQUIPMENT_BUCKET_LABELS: Record<string, string> = {
  active: "Active",
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  completed: "Completed",
};

function titleize(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForProjectSegment(segment: string): string {
  return PROJECT_LABELS[segment] ?? EQUIPMENT_BUCKET_LABELS[segment] ?? titleize(segment);
}

function buildProjectBreadcrumbs(
  segments: string[],
  projectName: string,
  projectPath: string,
): BreadcrumbItem[] {
  if (segments.length === 0) {
    return [
      { label: "Dashboard", to: "/dashboard" },
      { label: projectName },
    ];
  }

  const items: BreadcrumbItem[] = [
    { label: "Dashboard", to: "/dashboard" },
    { label: projectName, to: `${projectPath}/overview` },
  ];

  const [first, second, ...remaining] = segments;
  if (!first) return items;

  if (first === "finances" && second) {
    items.push({ label: "Finance", to: `${projectPath}/finances` });
    items.push({ label: labelForProjectSegment(second) });
    return items;
  }

  if (first === "materials" && second) {
    items.push({ label: "Materials", to: `${projectPath}/materials` });
    items.push({ label: labelForProjectSegment(second) });
    return items;
  }

  if (first === "equipment-requests" && second) {
    items.push({ label: "Equipment Requests", to: `${projectPath}/equipment-requests` });
    items.push({ label: labelForProjectSegment(second) });
    return items;
  }

  if (first === "activities" && second) {
    items.push({ label: "Site Activity", to: `${projectPath}/activities` });
    items.push({ label: labelForProjectSegment(second) });
    return items;
  }

  items.push({ label: labelForProjectSegment(first) });
  remaining.forEach((segment) => items.push({ label: labelForProjectSegment(segment) }));

  return items;
}

function buildBreadcrumbs(pathname: string, projectName?: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const [root, second, ...rest] = segments;

  if (root === "auth") {
    return [
      { label: "Home", to: "/" },
      { label: AUTH_LABELS[second ?? "sign-up"] ?? titleize(second ?? "sign-up") },
    ];
  }

  if (root === "dashboard") {
    if (segments.length === 1) return [{ label: "Dashboard" }];
    return [
      { label: "Dashboard", to: "/dashboard" },
      ...segments.slice(1).map((segment, index) => ({
        label: DASHBOARD_LABELS[segment] ?? titleize(segment),
        to: index === segments.length - 2 ? undefined : `/dashboard/${segments.slice(1, index + 2).join("/")}`,
      })),
    ];
  }

  if (root === "project" && second === "create") {
    return [
      { label: "Dashboard", to: "/dashboard" },
      { label: "New Project" },
    ];
  }

  if (root === "project" && second) {
    return buildProjectBreadcrumbs(
      rest,
      projectName ?? titleize(second),
      `/project/${second}`,
    );
  }

  if (root === "my-build") {
    return [{ label: "My Build" }];
  }

  if (root === "accept-invitation") {
    return [
      { label: "Home", to: "/" },
      { label: "Organization Invitation" },
    ];
  }

  if (root === "accept-project-invite") {
    return [
      { label: "Home", to: "/" },
      { label: "Project Invitation" },
    ];
  }

  return [{ label: "BuildPanda" }];
}

function ProjectBreadcrumbNameProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: string;
}) {
  return (
    <ProjectBreadcrumbNameContext.Provider value={value}>
      {children}
    </ProjectBreadcrumbNameContext.Provider>
  );
}

function RouteBreadcrumbs({ className, projectName }: { className?: string; projectName?: string }) {
  const location = useLocation();
  const contextProjectName = useContext(ProjectBreadcrumbNameContext);
  const items = buildBreadcrumbs(location.pathname, projectName ?? contextProjectName);

  return <Breadcrumbs items={items} className={className} />;
}

Breadcrumbs.displayName = "Breadcrumbs";
RouteBreadcrumbs.displayName = "RouteBreadcrumbs";
ProjectBreadcrumbNameProvider.displayName = "ProjectBreadcrumbNameProvider";

export {
  Breadcrumbs,
  ProjectBreadcrumbNameProvider,
  RouteBreadcrumbs,
  type BreadcrumbsProps,
  type BreadcrumbItem,
};

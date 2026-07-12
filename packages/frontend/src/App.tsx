import { createBrowserRouter, Navigate, RouterProvider, useRouteError } from "react-router-dom";
import { lazy as reactLazy, type ComponentType, type ReactElement } from "react";
import {
  HomeRedirect,
  RequireAuth,
  RequireCompany,
  ProjectFeatureFlagGate,
  ProjectPermissionGate,
  OrgPermissionGate,
  SalesFeatureFlagGate,
} from "@/lib/route-guards";
import { Toaster } from "@/components/atoms/toaster";
import { withMaintenanceMode } from "@/lib/with-maintenance-mode";
import { ErrorFallback } from "@/components/atoms/error-fallback";

function RouterErrorPage() {
  const routeError = useRouteError();
  const error =
    routeError instanceof Error
      ? routeError
      : new Error(
          typeof (routeError as { statusText?: string; message?: string })?.statusText === "string"
            ? (routeError as { statusText: string }).statusText
            : typeof (routeError as { message?: string })?.message === "string"
              ? (routeError as { message: string }).message
              : "An unexpected error occurred",
        );
  return <ErrorFallback error={error} reset={() => window.location.reload()} />;
}

// After a deploy, Vite emits new hashed chunk filenames. A browser holding a
// stale index.html (or an open tab) requests an old chunk that no longer exists
// and the dynamic import rejects. Reload once to fetch the fresh entry + chunks
// instead of crashing the route; a session flag prevents an infinite loop.
function lazy<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  const RELOAD_KEY = "buildpanda:chunk-reloaded";
  return reactLazy(() =>
    factory()
      .then((mod) => {
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      })
      .catch((error: unknown) => {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return new Promise<{ default: T }>(() => {}); // hold render until reload
        }
        throw error;
      }),
  );
}

const AuthLayout = lazy(() => import("@/layouts/auth-layout"));
const SignUp = lazy(() => import("@/pages/auth/sign-up"));
const SignIn = lazy(() => import("@/pages/auth/sign-in"));
const ForgotPassword = lazy(() => import("@/pages/auth/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/auth/reset-password"));
const VerifyEmail = lazy(() => import("@/pages/auth/verify-email"));

const DashboardLayout = lazy(() => import("@/layouts/dashboard-layout"));
const SalesLayout = lazy(() => import("@/layouts/sales-layout"));
const SalesDashboard = lazy(() => import("@/pages/sales/index"));
const SalesLeads = lazy(() => import("@/pages/sales/leads"));
const SalesProposals = lazy(() => import("@/pages/sales/proposals"));
const SalesPreconSession = lazy(() => import("@/pages/sales/precon-session"));
const SalesProposalWorkspace = lazy(() => import("@/pages/sales/proposal-workspace"));
const SalesSettings = lazy(() => import("@/pages/sales/settings"));
const ProjectLayout = lazy(() => import("@/layouts/project-layout"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const SettingsPage = lazy(() => import("@/pages/dashboard/settings"));
const TeamSettings = lazy(() => import("@/pages/dashboard/settings/team"));
const NotificationSettings = lazy(() => import("@/pages/dashboard/settings/notifications"));
const AcceptInvitation = lazy(
  () => import("@/pages/accept-invitation"),
);
const CreateProject = lazy(() => import("@/pages/project/create"));
const ImportWizard = lazy(() => import("@/pages/import"));

const ProjectChat = lazy(() => import("@/pages/project/chat"));

const ProjectOverview = lazy(() => import("@/pages/project/overview"));
const ProjectUpdates = lazy(() => import("@/pages/project/updates"));
const ProjectFinances = lazy(() => import("@/pages/project/finances"));
const ProjectBudgetAllocation = lazy(
  () => import("@/pages/project/budget-allocation"),
);
const ProjectMilestonePayments = lazy(
  () => import("@/pages/project/milestone-payments"),
);
const ProjectInvoices = lazy(() => import("@/pages/project/invoices"));
const ProjectInvoiceNew = lazy(() => import("@/pages/project/invoices/new"));
const ProjectPaymentClaims = lazy(() => import("@/pages/project/payment-claims"));
const ProjectPurchaseOrders = lazy(() => import("@/pages/project/purchase-orders"));
const ProjectBudget = lazy(() => import("@/pages/project/budget"));
const ProjectPandaAi = lazy(() => import("@/pages/project/panda-ai"));
const ProjectMaterials = lazy(() => import("@/pages/project/materials"));
const ProjectMaterialLog = lazy(() => import("@/pages/project/material-log"));
const ProjectEquipmentRequests = lazy(() => import("@/pages/project/equipment-requests"));
const ProjectSuppliers = lazy(() => import("@/pages/project/suppliers"));
const ProjectLookAheads = lazy(() => import("@/pages/project/look-aheads"));
const ProjectDocuments = lazy(() => import("@/pages/project/documents"));
const ProjectTeam = lazy(() => import("@/pages/project/team"));
const ProjectInspections = lazy(() => import("@/pages/project/inspections"));
const ProjectSettings = lazy(() => import("@/pages/project/settings"));
const ProjectActivities = lazy(() => import("@/pages/project/activities"));
const ProjectSchedule = lazy(() => import("@/pages/project/schedule"));
const ProjectDailyLog = lazy(() => import("@/pages/project/daily-log"));
const ProjectStages = lazy(() => import("@/pages/project/stages"));
const ProjectActionItems = lazy(() => import("@/pages/project/action-items"));
const ProjectTasks = lazy(() => import("@/pages/project/tasks"));
const ProjectQueries = lazy(() => import("@/pages/project/queries"));
const ProjectRfis = lazy(() => import("@/pages/project/rfis"));
const ProjectBim = lazy(() => import("@/pages/project/bim"));
const ProjectApprovals = lazy(() => import("@/pages/project/approvals"));
const ProjectSelections = lazy(() => import("@/pages/project/selections"));
const ProjectChangeRequests = lazy(() => import("@/pages/project/change-requests"));
const ProjectPermits = lazy(() => import("@/pages/project/permits"));
const ProjectKeyDates = lazy(() => import("@/pages/project/key-dates"));
const ProjectWhatsNext = lazy(() => import("@/pages/project/whats-next"));
const ProjectPeople = lazy(() => import("@/pages/project/people"));
const MyBuild = lazy(() => import("@/pages/my-build"));
const AcceptProjectInvite = lazy(() => import("@/pages/accept-project-invite"));
const PublicProposalPage = lazy(() => import("@/pages/public/proposal-page"));
const SharePage = lazy(() => import("@/pages/public/share-page"));
const PrivacyPolicyPage = lazy(() => import("@/pages/public/privacy-page"));
const DataPolicyPage = lazy(() => import("@/pages/public/data-policy-page"));
const TermsOfServicePage = lazy(() => import("@/pages/public/terms-page"));

function pf(flag: string, el: ReactElement) {
  return <ProjectFeatureFlagGate flag={flag}>{el}</ProjectFeatureFlagGate>;
}
/** Feature flag + resource permission (RBAC) gate for project routes. */
function pfr(flag: string, resource: string, el: ReactElement) {
  return (
    <ProjectFeatureFlagGate flag={flag}>
      <ProjectPermissionGate resource={resource}>{el}</ProjectPermissionGate>
    </ProjectFeatureFlagGate>
  );
}
function sf(flag: string, el: ReactElement) {
  return <SalesFeatureFlagGate flag={flag}>{el}</SalesFeatureFlagGate>;
}

export const router = createBrowserRouter([
  {
    errorElement: <RouterErrorPage />,
    children: [
  {
    path: "/",
    element: <HomeRedirect />,
  },
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { index: true, element: <SignUp /> },
      { path: "sign-up", element: <SignUp /> },
      { path: "sign-in", element: <SignIn /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "verify-email", element: <VerifyEmail /> },
    ],
  },
  {
    path: "/dashboard",
    element: (
      <RequireCompany>
        <DashboardLayout />
      </RequireCompany>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "settings", element: <SettingsPage /> },
      {
        path: "settings/team",
        element: (
          <OrgPermissionGate resource="teamMembers" action="manage">
            <TeamSettings />
          </OrgPermissionGate>
        ),
      },
      { path: "settings/notifications", element: <NotificationSettings /> },
    ],
  },
  {
    path: "/sales",
    element: (
      <RequireCompany>
        <SalesLayout />
      </RequireCompany>
    ),
    children: [
      { index: true, element: <SalesDashboard /> },
      { path: "leads", element: sf("sales.leads", <SalesLeads />) },
      { path: "proposals", element: sf("sales.proposals", <SalesProposals />) },
      { path: "proposals/:id", element: sf("sales.proposals", <SalesProposalWorkspace />) },
      { path: "preconstruction/:sessionId", element: sf("ai.preconstruction", <SalesPreconSession />) },
      { path: "settings", element: <SalesSettings /> },
    ],
  },
  {
    path: "/p/:token",
    element: <PublicProposalPage />,
  },
  {
    path: "/share/:token",
    element: <SharePage />,
  },
  {
    path: "/terms",
    element: <TermsOfServicePage />,
  },
  {
    path: "/privacy",
    element: <PrivacyPolicyPage />,
  },
  {
    path: "/data-policy",
    element: <DataPolicyPage />,
  },
  {
    path: "/dpa",
    element: <DataPolicyPage />,
  },
  {
    path: "/accept-invitation/:invitationId",
    element: <AcceptInvitation />,
  },
  {
    path: "/accept-project-invite/:token",
    element: <AcceptProjectInvite />,
  },
  {
    path: "/my-build",
    element: (
      <RequireAuth>
        <MyBuild />
      </RequireAuth>
    ),
  },
  {
    path: "/project/create",
    element: (
      <RequireCompany>
        <CreateProject />
      </RequireCompany>
    ),
  },
  {
    path: "/import",
    element: (
      <RequireCompany>
        <ImportWizard />
      </RequireCompany>
    ),
  },
  {
    // Both account types may open a project: company staff manage it, owners
    // and other participants get the scoped portal view. The backend's
    // org/participant checks are the real authorization.
    path: "/project/:projectId",
    element: (
      <RequireAuth>
        <ProjectLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: "overview", element: <ProjectOverview /> },
      { path: "settings", element: <ProjectSettings /> },

      { path: "updates", element: pf("project.updates", <ProjectUpdates />) },
      { path: "chat", element: pf("collaboration.messaging", <ProjectChat />) },
      { path: "messages", element: pf("collaboration.messaging", <ProjectChat />) },
      { path: "panda-ai", element: pf("ai.insights", <ProjectPandaAi />) },
      { path: "people", element: pf("collaboration.participants", <ProjectPeople />) },

      { path: "documents", element: pf("projects.documents", <ProjectDocuments />) },
      { path: "team", element: pf("project.team", <ProjectTeam />) },
      { path: "inspections", element: pf("quality.inspections", <ProjectInspections />) },
      { path: "daily-log", element: pf("quality.dailyLogs", <ProjectDailyLog />) },
      { path: "look-aheads", element: pf("projects.schedule", <ProjectLookAheads />) },
      { path: "bim", element: pf("projects.bim", <ProjectBim />) },

      { path: "action-items", element: pf("workflow.actionItems", <ProjectActionItems />) },
      { path: "tasks", element: pf("projects.schedule", <ProjectTasks />) },
      { path: "queries", element: pf("workflow.queries", <ProjectQueries />) },
      { path: "rfis", element: pf("workflow.rfis", <ProjectRfis />) },
      { path: "approvals", element: pf("workflow.approvals", <ProjectApprovals />) },
      { path: "selections", element: pf("projects.selections", <ProjectSelections />) },
      { path: "change-requests", element: pf("workflow.changeRequests", <ProjectChangeRequests />) },
      { path: "permits", element: pf("compliance.permits", <ProjectPermits />) },
      { path: "key-dates", element: pf("compliance.keyDates", <ProjectKeyDates />) },
      { path: "whats-next", element: <ProjectWhatsNext /> },

      { path: "finances", element: pfr("commercial.finances", "finances", <ProjectFinances />) },
      { path: "finances/budget-allocation", element: pfr("commercial.budget", "finances", <ProjectBudgetAllocation />) },
      { path: "finances/milestone-payments", element: pfr("commercial.finances", "finances", <ProjectMilestonePayments />) },
      { path: "finances/invoices", element: pfr("commercial.invoices", "finances", <ProjectInvoices />) },
      { path: "finances/invoices/new", element: pfr("commercial.invoices", "finances", <ProjectInvoiceNew />) },
      { path: "finances/payment-claims", element: pfr("commercial.paymentClaims", "finances", <ProjectPaymentClaims />) },
      { path: "finances/purchase-orders", element: pfr("commercial.purchaseOrders", "finances", <ProjectPurchaseOrders />) },
      { path: "finances/budget", element: pfr("commercial.budget", "finances", <ProjectBudget />) },

      { path: "materials", element: pf("commercial.materialsEquipment", <ProjectMaterials />) },
      { path: "material-log", element: pf("commercial.materialsLedger", <ProjectMaterialLog />) },
      { path: "materials/orders", element: pf("commercial.materialsEquipment", <ProjectMaterials />) },
      { path: "materials/requests", element: pf("commercial.materialsEquipment", <ProjectMaterials />) },
      { path: "equipment-requests", element: pf("commercial.materialsEquipment", <ProjectEquipmentRequests />) },
      { path: "equipment-requests/:bucket", element: pf("commercial.materialsEquipment", <ProjectEquipmentRequests />) },
      { path: "suppliers", element: pf("commercial.materialsEquipment", <ProjectSuppliers />) },

      { path: "schedules/activities", element: pf("projects.schedule", <ProjectActivities />) },
      { path: "schedules/activities/:activityId", element: pf("projects.schedule", <ProjectActivities />) },
      { path: "schedules/milestones", element: pfr("commercial.finances", "finances", <ProjectMilestonePayments />) },
      { path: "schedules/project-chart", element: pf("projects.schedule", <ProjectSchedule />) },
      { path: "schedules/stages", element: pf("projects.schedule", <ProjectStages />) },
      { path: "schedules/key-dates", element: pf("compliance.keyDates", <ProjectKeyDates />) },
      { path: "schedules/whats-next", element: <ProjectWhatsNext /> },
      { path: "schedules/daily-log", element: pf("quality.dailyLogs", <ProjectDailyLog />) },

      // legacy flat routes kept for deep-link compatibility
      { path: "activities", element: pf("projects.schedule", <ProjectActivities />) },
      { path: "activities/:activityId", element: pf("projects.schedule", <ProjectActivities />) },
      { path: "milestones", element: pfr("commercial.finances", "finances", <ProjectMilestonePayments />) },
      { path: "project-chart", element: pf("projects.schedule", <ProjectSchedule />) },
      { path: "schedule", element: pf("projects.schedule", <ProjectSchedule />) },
      { path: "stages", element: pf("projects.schedule", <ProjectStages />) },
    ],
  },
  ], // children of root error-boundary route
  }, // root error-boundary route
]);

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

export default withMaintenanceMode(App);

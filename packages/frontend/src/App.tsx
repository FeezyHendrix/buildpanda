import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { lazy as reactLazy, type ComponentType } from "react";
import { HomeRedirect, RequireAuth, RequireCompany } from "@/lib/route-guards";

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
const SalesProposalWorkspace = lazy(() => import("@/pages/sales/proposal-workspace"));
const SalesSettings = lazy(() => import("@/pages/sales/settings"));
const ProjectLayout = lazy(() => import("@/layouts/project-layout"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const TeamSettings = lazy(() => import("@/pages/dashboard/settings/team"));
const AcceptInvitation = lazy(
  () => import("@/pages/accept-invitation"),
);
const CreateProject = lazy(() => import("@/pages/project/create"));

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
const ProjectBudget = lazy(() => import("@/pages/project/budget"));
const ProjectPandaAi = lazy(() => import("@/pages/project/panda-ai"));
const ProjectMaterials = lazy(() => import("@/pages/project/materials"));
const ProjectEquipmentRequests = lazy(() => import("@/pages/project/equipment-requests"));
const ProjectDocuments = lazy(() => import("@/pages/project/documents"));
const ProjectTeam = lazy(() => import("@/pages/project/team"));
const ProjectInspections = lazy(() => import("@/pages/project/inspections"));
const ProjectMessages = lazy(() => import("@/pages/project/messages"));
const ProjectSettings = lazy(() => import("@/pages/project/settings"));
const ProjectActivities = lazy(() => import("@/pages/project/activities"));
const ProjectSchedule = lazy(() => import("@/pages/project/schedule"));
const ProjectDailyLog = lazy(() => import("@/pages/project/daily-log"));
const ProjectStages = lazy(() => import("@/pages/project/stages"));
const ProjectActionItems = lazy(() => import("@/pages/project/action-items"));
const ProjectQueries = lazy(() => import("@/pages/project/queries"));
const ProjectApprovals = lazy(() => import("@/pages/project/approvals"));
const ProjectChangeRequests = lazy(() => import("@/pages/project/change-requests"));
const ProjectPermits = lazy(() => import("@/pages/project/permits"));
const ProjectKeyDates = lazy(() => import("@/pages/project/key-dates"));
const ProjectWhatsNext = lazy(() => import("@/pages/project/whats-next"));
const ProjectPeople = lazy(() => import("@/pages/project/people"));
const MyBuild = lazy(() => import("@/pages/my-build"));
const AcceptProjectInvite = lazy(() => import("@/pages/accept-project-invite"));

const router = createBrowserRouter([
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
      { path: "settings/team", element: <TeamSettings /> },
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
      { path: "leads", element: <SalesLeads /> },
      { path: "proposals", element: <SalesProposals /> },
      { path: "proposals/:id", element: <SalesProposalWorkspace /> },
      { path: "settings", element: <SalesSettings /> },
    ],
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
      { path: "updates", element: <ProjectUpdates /> },
      { path: "finances", element: <ProjectFinances /> },
      {
        path: "finances/budget-allocation",
        element: <ProjectBudgetAllocation />,
      },
      {
        path: "finances/milestone-payments",
        element: <ProjectMilestonePayments />,
      },
      { path: "finances/invoices", element: <ProjectInvoices /> },
      { path: "finances/budget", element: <ProjectBudget /> },
      { path: "panda-ai", element: <ProjectPandaAi /> },
      { path: "materials", element: <ProjectMaterials /> },
      { path: "materials/orders", element: <ProjectMaterials /> },
      { path: "materials/requests", element: <ProjectMaterials /> },
      { path: "equipment-requests", element: <ProjectEquipmentRequests /> },
      { path: "equipment-requests/:bucket", element: <ProjectEquipmentRequests /> },
      { path: "documents", element: <ProjectDocuments /> },
      { path: "team", element: <ProjectTeam /> },
      { path: "inspections", element: <ProjectInspections /> },
      { path: "messages", element: <ProjectMessages /> },
      { path: "settings", element: <ProjectSettings /> },
      { path: "activities", element: <ProjectActivities /> },
      { path: "activities/:activityId", element: <ProjectActivities /> },
      { path: "milestones", element: <ProjectMilestonePayments /> },
      { path: "project-chart", element: <ProjectSchedule /> },
      { path: "schedule", element: <ProjectSchedule /> },
      { path: "stages", element: <ProjectStages /> },
      { path: "action-items", element: <ProjectActionItems /> },
      { path: "queries", element: <ProjectQueries /> },
      { path: "approvals", element: <ProjectApprovals /> },
      { path: "change-requests", element: <ProjectChangeRequests /> },
      { path: "permits", element: <ProjectPermits /> },
      { path: "key-dates", element: <ProjectKeyDates /> },
      { path: "whats-next", element: <ProjectWhatsNext /> },
      { path: "people", element: <ProjectPeople /> },
      { path: "daily-log", element: <ProjectDailyLog /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

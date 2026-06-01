import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { lazy } from "react";

const AuthLayout = lazy(() => import("@/layouts/auth-layout"));
const SignUp = lazy(() => import("@/pages/auth/sign-up"));
const SignIn = lazy(() => import("@/pages/auth/sign-in"));
const ForgotPassword = lazy(() => import("@/pages/auth/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/auth/reset-password"));
const VerifyEmail = lazy(() => import("@/pages/auth/verify-email"));

const DashboardLayout = lazy(() => import("@/layouts/dashboard-layout"));
const ProjectLayout = lazy(() => import("@/layouts/project-layout"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
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
const ProjectMaterials = lazy(() => import("@/pages/project/materials"));
const ProjectDocuments = lazy(() => import("@/pages/project/documents"));
const ProjectContractors = lazy(() => import("@/pages/project/contractors"));
const ProjectInspections = lazy(() => import("@/pages/project/inspections"));
const ProjectMessages = lazy(() => import("@/pages/project/messages"));
const ProjectSettings = lazy(() => import("@/pages/project/settings"));
const ProjectActivities = lazy(() => import("@/pages/project/activities"));
const ProjectSchedule = lazy(() => import("@/pages/project/schedule"));
const ProjectDailyLog = lazy(() => import("@/pages/project/daily-log"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
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
    element: <DashboardLayout />,
    children: [{ index: true, element: <Dashboard /> }],
  },
  {
    path: "/project/create",
    element: <CreateProject />,
  },
  {
    path: "/project/:projectId",
    element: <ProjectLayout />,
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
      { path: "materials", element: <ProjectMaterials /> },
      { path: "documents", element: <ProjectDocuments /> },
      { path: "contractors", element: <ProjectContractors /> },
      { path: "inspections", element: <ProjectInspections /> },
      { path: "messages", element: <ProjectMessages /> },
      { path: "settings", element: <ProjectSettings /> },
      { path: "activities", element: <ProjectActivities /> },
      { path: "activities/:activityId", element: <ProjectActivities /> },
      { path: "milestones", element: <ProjectMilestonePayments /> },
      { path: "project-chart", element: <ProjectSchedule /> },
      { path: "schedule", element: <ProjectSchedule /> },
      { path: "daily-log", element: <ProjectDailyLog /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

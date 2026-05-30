import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { lazy } from "react";

const AuthLayout = lazy(() => import("@/layouts/auth-layout"));
const SignUp = lazy(() => import("@/pages/auth/sign-up"));
const SignIn = lazy(() => import("@/pages/auth/sign-in"));
const ForgotPassword = lazy(() => import("@/pages/auth/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/auth/reset-password"));
const VerifyEmail = lazy(() => import("@/pages/auth/verify-email"));

const DashboardLayout = lazy(() => import("@/layouts/dashboard-layout"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const CreateProject = lazy(() => import("@/pages/project/create"));

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
    children: [
      { index: true, element: <Dashboard /> },
    ],
  },
  {
    path: "/project/create",
    element: <CreateProject />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

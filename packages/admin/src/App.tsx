import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAdmin } from "@/components/require-admin";
import { Layout } from "@/components/layout";
import SignInPage from "@/pages/sign-in";
import DashboardPage from "@/pages/dashboard";
import UsersPage from "@/pages/users";
import UserDetailPage from "@/pages/user-detail";
import OrganizationsPage from "@/pages/organizations";
import OrganizationDetailPage from "@/pages/organization-detail";
import ProjectsPage from "@/pages/projects";
import ProjectDetailPage from "@/pages/project-detail";
import LeadsPage from "@/pages/leads";
import JobsPage from "@/pages/jobs";
import MaintenancePage from "@/pages/maintenance";
import FeatureFlagsPage from "@/pages/feature-flags";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="organizations/:id" element={<OrganizationDetailPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="feature-flags" element={<FeatureFlagsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

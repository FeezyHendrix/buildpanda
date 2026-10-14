import type { AccessScope, PermissionMap } from "@/lib/access-policy";
import { request } from "./client";

export interface ProjectAccessResponse extends AccessScope {
  permissions: PermissionMap;
  workspacePermissions: PermissionMap;
  capabilities: Readonly<Record<string, boolean>>;
  relationship: string;
}
export const projectAccessApi = {
  get: (projectId: string) => request<ProjectAccessResponse>(`/projects/${projectId}/access`),
};

import type { Knex } from "knex";
import type { ProjectSectionPermissions } from "../../../lib/authorization.ts";
import type { PermissionMap } from "../../../lib/permissions.ts";
import type { QueueManager } from "../../../lib/queue/index.ts";

export interface ToolResult {
  output: unknown;
  navigate?: string;
}

export interface AgentCaller {
  user: { id: string; name: string };
  project: { id: string; ownerId: string | null; organizationId: string | null };
  orgRoles: ReadonlyMap<string, string>;
  projectRoles: ReadonlyMap<string, string>;
  orgPermissions: ReadonlyMap<string, PermissionMap>;
  projectSectionPermissions: ReadonlyMap<string, ProjectSectionPermissions>;
  projectGrants: ReadonlyMap<string, Record<string, readonly string[]>>;
}

export interface ToolContext {
  db: Knex;
  projectId: string;
  caller: AgentCaller;
  queue?: QueueManager;
}

import type { EnrichedAccessContext } from "../../lib/authorization.ts";
import type { AuthorizationRequest, AuthorizedProject } from "../../lib/authorization-request.ts";
import type { CreateDailyLogEntryInput, UpsertDailyLogInput } from "../daily-logs/types.ts";
import type { DailyLogsService } from "../daily-logs/service.ts";

export interface FieldActor {
  userId: string;
  organizationId: string | null;
}

interface DailyLogTarget {
  projectId: string;
  buildingId: string;
  logDate: string;
}

export type DailyLogCommand = DailyLogTarget & (
  | { kind: "daily_log"; payload: CreateDailyLogEntryInput }
  | { kind: "update_daily_log"; payload: UpsertDailyLogInput }
);

export interface FieldActionUser {
  id: string;
  name: string;
  banned?: boolean;
  banExpires?: Date | string | null;
}

export interface DailyLogScope {
  project: AuthorizedProject;
  buildingId: string;
  request: AuthorizationRequest;
  author: { id: string; name: string; role: string };
}

export interface DailyLogAuthorizationDeps {
  userById(userId: string): Promise<FieldActionUser | undefined>;
  loadAccess(userId: string): Promise<EnrichedAccessContext>;
  projectById(projectId: string): Promise<AuthorizedProject | undefined>;
  isEnabled(): Promise<boolean>;
  assertBuilding(projectId: string, buildingId: string): Promise<void>;
  soleRealBuildingId(projectId: string): Promise<string | undefined>;
}

export interface DailyLogExecutionDeps {
  lockTarget(command: DailyLogCommand): Promise<void>;
  authorize(actor: FieldActor, projectId: string, buildingId?: string): Promise<DailyLogScope>;
  logs: Pick<DailyLogsService, "addEntry" | "upsert">;
  requireFiles(request: AuthorizationRequest, projectId: string, payload: unknown): Promise<void>;
}

export interface FieldActionResult extends DailyLogTarget {
  kind: DailyLogCommand["kind"];
  recordId: string;
}

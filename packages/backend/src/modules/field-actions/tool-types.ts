import type { Knex } from "knex";
import type { AuthorizationRequest, AuthorizedProject } from "../../lib/authorization-request.ts";
import type { QueueManager } from "../../lib/queue/index.ts";
import type { FieldActionUser, FieldActor } from "./types.ts";
import type { VoiceActionKind, VoiceReviewField } from "@buildpanda/voice-actions";
import type { siteBackendDefinitions } from "./site-backend-records.ts";

export type FieldToolKind = VoiceActionKind | keyof typeof siteBackendDefinitions;

export interface FieldToolDescriptor {
  kind: FieldToolKind;
  label: string;
  description: string;
  schema: object;
  fields: VoiceReviewField[];
  requiresBuilding: boolean;
  destructive: boolean;
}

export interface FieldToolInput {
  kind: string;
  projectId: string;
  buildingId: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export interface FieldToolContext {
  db: Knex;
  queue?: QueueManager;
  actor: FieldActor;
  user: FieldActionUser;
  request: AuthorizationRequest;
  project: AuthorizedProject;
  buildingId: string | null;
  requireFeature(key: string, label?: string): Promise<void>;
  requireFiles(payload: unknown): Promise<void>;
}

export interface FieldToolResult {
  kind: string;
  projectId: string;
  recordId: string;
  message?: string;
  data?: Record<string, unknown>;
}

export type FieldToolHandler = (input: FieldToolInput, context: FieldToolContext) => Promise<FieldToolResult>;

export interface FieldToolRequirement {
  features: readonly string[];
  permissions: readonly (readonly [string, string])[];
  anyPermissions?: readonly (readonly [string, string])[];
  permissionScope?: "project" | "workspace" | "either";
  readPermissions?: readonly (readonly [string, string])[];
}

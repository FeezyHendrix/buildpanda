import type { FastifyRequest } from "fastify";
import { assertOrganizationPermission, canProjectPermission } from "../../lib/authorization.ts";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { requireConversationPermission } from "../messaging/permission.ts";
import type { FileAccessRepository } from "./access-repository.ts";
import type { UploadedFileRow } from "./types.ts";
import type { FilesService } from "./service.ts";

export const STAGING_PERMISSIONS = [
  ["documents", "upload"], ["documents", "markup"], ["updates", "post"],
  ["dailyLog", "create"], ["materials", "request"], ["finances", "manage"],
  ["rfis", "create"], ["change-requests", "manage"], ["comments", "post"], ["messages", "send"],
] as const;

export async function requireFileStaging(request: FastifyRequest, projectId: string) {
  const project = await request.requireProjectAccess(projectId);
  const context = { userId: request.requireAuth().id, orgRoles: request.orgRoles,
    projectRoles: request.projectRoles, orgPermissions: request.orgPermissions,
    projectSectionPermissions: request.projectSectionPermissions, projectGrants: request.projectGrants };
  if (!STAGING_PERMISSIONS.some(([resource, action]) => canProjectPermission(
    { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, context, resource, action,
  ))) throw new ForbiddenError("Your role does not allow staging files for this project.");
}

export async function requireFileAttachment(request: FastifyRequest, projectId: string, fileId: string | null | undefined, files: FilesService, access: FileAccessRepository) {
  if (!fileId) return;
  const file = await files.findRow(fileId);
  if (!file) throw new NotFoundError("File");
  if (file.project_id && file.project_id !== projectId) throw new ForbiddenError("The file belongs to another project.");
  await requireFileRead(request, file, access);
}

export async function requireFileRead(request: FastifyRequest, file: UploadedFileRow, repository: FileAccessRepository) {
  const userId = request.requireAuth().id;
  const [references, conversations, organizations] = await Promise.all([
    repository.projectReferences(file.id), repository.messageReferences(file.id, userId), repository.organizationReferences(file.id),
  ]);
  for (const reference of references) {
    if (!reference.project_id) continue;
    if (file.project_id && reference.project_id !== file.project_id) continue;
    try {
      const project = await request.requireProjectPermission(reference.project_id, reference.resource, reference.action);
      // Shared RFI readers cannot open internal records or proposed responses.
      if (reference.resource === "rfis" && (reference.visibility !== "shared" || reference.is_proposed_response) && project.owner_id !== userId &&
        (!project.organization_id || !request.orgRoles.has(project.organization_id))) continue;
      return;
    } catch (error) { if (!(error instanceof ForbiddenError || error instanceof NotFoundError)) throw error; }
  }
  for (const reference of organizations) {
    try {
      if (file.project_id) {
        const project = await request.requireProjectAccess(file.project_id);
        if (project.organization_id !== reference.organizationId) continue;
      }
      assertOrganizationPermission(reference.organizationId, { userId, orgRoles: request.orgRoles, orgPermissions: request.orgPermissions }, reference.resource, reference.action);
      return;
    } catch (error) { if (!(error instanceof ForbiddenError || error instanceof NotFoundError)) throw error; }
  }
  for (const channel of conversations) {
    if (!channel.memberId || (file.project_id && channel.projectId !== file.project_id)) continue;
    try { await requireConversationPermission(request, channel, "view"); return; }
    catch (error) { if (!(error instanceof ForbiddenError || error instanceof NotFoundError)) throw error; }
  }
  // A staged original has not acquired the visibility of a published record.
  if (references.length === 0 && conversations.length === 0 && organizations.length === 0 && file.owner_id === userId) {
    if (file.project_id) await requireFileStaging(request, file.project_id);
    return;
  }
  throw new ForbiddenError("You do not have permission to view the record containing this file.");
}

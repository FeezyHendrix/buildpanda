import type { AuthorizationRequest } from "../../lib/authorization-request.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import type { FilesRepository } from "./repository.ts";
import type { FileAccessRepository } from "./access-repository.ts";
import { requireFileRead } from "./access.ts";

import { embeddedImages, imageError, MAX_CONTENT_IMAGES, referencedFileIds } from "@buildpanda/rich-content";
export { referencedFileIds } from "@buildpanda/rich-content";

export async function requireProjectFileReferences(request: AuthorizationRequest & { body?: unknown }, projectId: string | undefined, files: FilesRepository, access: FileAccessRepository) {
  const ids = referencedFileIds(request.body);
  if (!ids.length) return;
  request.requireAuth();
  if (projectId) await request.requireProjectAccess(projectId);
  const imageIds = new Set<string>();
  function inspect(value: unknown) {
    if (typeof value === 'string') {
      const images = embeddedImages(value);
      if (images.length > MAX_CONTENT_IMAGES) throw new BadRequestError('A field can contain up to 20 images.');
      images.forEach((image) => imageIds.add(image.fileId));
    } else if (Array.isArray(value)) value.forEach(inspect);
    else if (value && typeof value === 'object') Object.values(value).forEach(inspect);
  }
  inspect(request.body);
  const rows = await files.findByIds(ids);
  if (rows.length !== ids.length) throw new NotFoundError("Attachment");
  for (const file of rows) {
    if (file.project_id && file.project_id !== projectId) throw new ForbiddenError("The attachment belongs to another project.");
    if (imageIds.has(file.id)) {
      const error = imageError(file.mime_type, Number(file.size_bytes));
      if (error) throw new BadRequestError(error);
    }
    // Check before the new reference exists; otherwise linking a denied file could grant its read access.
    await requireFileRead(request, file, access);
  }
}

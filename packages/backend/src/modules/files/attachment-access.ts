import type { FastifyRequest } from "fastify";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import type { FilesRepository } from "./repository.ts";
import type { FileAccessRepository } from "./access-repository.ts";
import { requireFileRead } from "./access.ts";

/** Uploaded IDs and inline file URLs both create a disclosure in the destination record. */
export function referencedFileIds(body: unknown): string[] {
  const ids = new Set<string>();
  function visit(value: unknown, key = "") {
    if (typeof value === "string") {
      if (/^(?:fileIds?|file_ids?)$|(?:FileIds?|_file_ids?)$/.test(key) && value) ids.add(value);
      for (const match of value.matchAll(/\/files\/([a-zA-Z0-9_-]+)(?=\/|[?"'<>\s]|$)/g)) ids.add(match[1]!);
    } else if (Array.isArray(value)) value.forEach((item) => visit(item, key));
    else if (value && typeof value === "object") Object.entries(value).forEach(([name, item]) => visit(item, name));
  }
  visit(body);
  return [...ids];
}

export async function requireProjectFileReferences(request: FastifyRequest, projectId: string, files: FilesRepository, access: FileAccessRepository) {
  const ids = referencedFileIds(request.body);
  if (!ids.length) return;
  await request.requireProjectAccess(projectId);
  const rows = await files.findByIds(ids);
  if (rows.length !== ids.length) throw new NotFoundError("Attachment");
  for (const file of rows) {
    if (file.project_id && file.project_id !== projectId) throw new ForbiddenError("The attachment belongs to another project.");
    // Check before the new reference exists; otherwise linking a denied file could grant its read access.
    await requireFileRead(request, file, access);
  }
}

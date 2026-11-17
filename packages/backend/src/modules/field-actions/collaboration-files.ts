import { referencedFileIds } from "@buildpanda/rich-content";
import { BadRequestError } from "../../lib/errors.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import type { FieldToolContext } from "./tool-types.ts";

export async function collaborationFiles(context: FieldToolContext, payload: unknown) {
  await context.requireFiles(payload);
  return filesService(filesRepository(context.db)).projectRows(context.project.id, referencedFileIds(payload));
}

/** User URLs cannot turn an authorized file ID into a request to an arbitrary host. */
export function collaborationFileId(url: string) {
  const id = /^(?:\/api)?\/files\/([a-zA-Z0-9_-]{1,160})\/download$/.exec(url)?.[1];
  if (!id) throw new BadRequestError("Choose a project-uploaded file instead of an external media URL.");
  return id;
}

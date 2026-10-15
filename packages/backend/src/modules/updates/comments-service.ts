import { hasRichContent, plainTextFromHtml, voiceNoteError } from "@buildpanda/rich-content";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { FilesService } from "../files/service.ts";
import type { UpdatesRepository } from "./repository.ts";
import type { AddCommentInput, UpdateComment, UpdateCommentRow } from "./types.ts";
import { dictate } from "../../lib/speech.ts";

function toComment(row: UpdateCommentRow): UpdateComment {
  return {
    id: row.id, updateId: row.update_id, author: { id: row.author_id, name: row.author_name },
    body: row.body, bodyHtml: row.body_html ?? null, audioFileId: row.audio_file_id ?? null,
    audioDurationSeconds: row.audio_duration_seconds ?? null, createdAt: new Date(row.created_at).toISOString(),
  };
}

export function updateCommentsService(repository: UpdatesRepository, files?: Pick<FilesService, "findRow">) {
  async function requirePublished(projectId: string, updateId: string) {
    const update = await repository.findById(updateId);
    if (!update || update.project_id !== projectId || update.is_draft) throw new NotFoundError("Published update");
  }
  return {
    requirePublished,
    async transcribeComment(projectId: string, updateId: string, audio: Blob, fileName: string) {
      await requirePublished(projectId, updateId);
      const error = voiceNoteError(audio.type, audio.size);
      if (error) throw new BadRequestError(error);
      return dictate(audio, fileName);
    },
    async listComments(projectId: string, updateId: string): Promise<UpdateComment[]> {
      await requirePublished(projectId, updateId);
      return (await repository.listComments(updateId)).map(toComment);
    },
    async addComment(projectId: string, updateId: string, input: AddCommentInput, actor: { id: string; name: string }): Promise<UpdateComment> {
      await requirePublished(projectId, updateId);
      const html = input.bodyHtml?.trim() || null;
      const body = html ? plainTextFromHtml(html) : input.body?.trim() ?? "";
      if (!body && !hasRichContent(html ?? "") && !input.audioFileId) throw new BadRequestError("Add a comment, image or voice note.");
      if (body.length > 2000) throw new BadRequestError("Comments can contain up to 2,000 characters.");
      if (input.audioFileId) {
        const file = await files?.findRow(input.audioFileId);
        if (!file || file.project_id !== projectId) throw new NotFoundError("Audio file in this project");
        const error = voiceNoteError(file.mime_type, Number(file.size_bytes), input.audioDurationSeconds ?? 0);
        if (error) throw new BadRequestError(error);
      } else if (input.audioDurationSeconds != null) throw new BadRequestError("A duration requires a voice note.");
      return toComment(await repository.addComment({
        id: generateId("comment"), update_id: updateId, author_id: actor.id, author_name: actor.name,
        body, body_html: html, audio_file_id: input.audioFileId ?? null,
        audio_duration_seconds: input.audioDurationSeconds ?? null, client_mutation_id: input.clientMutationId ?? null,
      }));
    },
  };
}

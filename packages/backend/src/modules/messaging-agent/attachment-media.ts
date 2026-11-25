import { z } from "zod";
import { BadRequestError } from "../../lib/errors.ts";
import type { MessagingAttachmentIdentity } from "./attachment-types.ts";
import type { MessagingChannelId } from "./types.ts";

const identitySchema = z.object({
  providerId: z.string().regex(/^[A-Za-z0-9_-]{1,512}$/),
  fileName: z.string().min(1).max(255).refine((value) => !/[\u0000-\u001f\u007f/\\]/.test(value)),
  mimeType: z.string().regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/).max(100).optional(),
  sizeBytes: z.number().int().positive().safe().optional(),
}).strict();

export function attachmentMediaId(channel: MessagingChannelId, identity: MessagingAttachmentIdentity): string {
  const checked = identitySchema.safeParse(identity);
  if (!checked.success) throw new BadRequestError("Attachment metadata is invalid.");
  return `${channel}:file:${Buffer.from(JSON.stringify(checked.data)).toString("base64url")}`;
}

export function parseAttachmentMediaId(channel: MessagingChannelId, value: string): MessagingAttachmentIdentity {
  const prefix = `${channel}:file:`;
  if (!value.startsWith(prefix) || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value.slice(prefix.length))) throw new BadRequestError("Attachment identity is invalid.");
  try { return identitySchema.parse(JSON.parse(Buffer.from(value.slice(prefix.length), "base64url").toString("utf8"))); }
  catch { throw new BadRequestError("Attachment metadata is invalid."); }
}

export function attachmentMime(value: string | undefined): string | undefined {
  return value?.split(";")[0]?.trim().toLowerCase();
}

export async function boundedAttachmentBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const rawLength = response.headers.get("content-length");
  if ((rawLength !== null && (!/^\d+$/.test(rawLength) || Number(rawLength) > maxBytes)) || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new BadRequestError("The attachment is empty or exceeds the upload limit.");
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) throw new BadRequestError("The attachment exceeds the upload limit.");
      chunks.push(next.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  if (!size) throw new BadRequestError("The attachment is empty.");
  return Buffer.concat(chunks, size);
}

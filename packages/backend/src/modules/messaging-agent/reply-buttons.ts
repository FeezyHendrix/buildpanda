import type { MessagingReplyButton, MessagingReviewButtonCommand } from "./types.ts";

export function parseReviewButtonCommand(value: unknown): MessagingReviewButtonCommand | null {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 64) return null;
  const match = /^(CONFIRM|CANCEL) ([A-Za-z0-9_-]{1,48}) ([1-9]\d{0,5})$/.exec(value);
  return match ? { action: match[1] as MessagingReviewButtonCommand["action"], proposalId: match[2]!, version: Number(match[3]) } : null;
}

export function isReviewCommand(value: unknown): value is string {
  return parseReviewButtonCommand(value) !== null;
}

export function validReviewButtons(value: unknown): value is MessagingReplyButton[] {
  if (Array.isArray(value) && value.length === 1) return value[0]?.label === "Cancel" && parseReviewButtonCommand(value[0]?.command)?.action === "CANCEL";
  if (!Array.isArray(value) || value.length !== 2 || value[0]?.label !== "Confirm" || value[1]?.label !== "Cancel") return false;
  const confirm = parseReviewButtonCommand(value[0]?.command), cancel = parseReviewButtonCommand(value[1]?.command);
  return confirm?.action === "CONFIRM" && cancel?.action === "CANCEL"
    && confirm.proposalId === cancel.proposalId && confirm.version === cancel.version;
}

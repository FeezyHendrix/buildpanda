import { BadRequestError } from "../../lib/errors.ts";
import type { MessagingReplyButton } from "./types.ts";

export function messagingReplyParts(body: string, maxTextLength: number, buttons?: MessagingReplyButton[], maxButtonLength = maxTextLength) {
  if (maxTextLength < 100 || maxButtonLength < 100) throw new BadRequestError("The channel's message limit is invalid.");
  if (body.length <= (buttons ? maxButtonLength : maxTextLength)) return [{ body, buttons }];
  const parts: { body: string; buttons?: MessagingReplyButton[] }[] = [];
  let remaining = body;
  while (remaining.length > maxTextLength) {
    let end = remaining.lastIndexOf("\n", maxTextLength);
    if (end < maxTextLength / 2) end = remaining.lastIndexOf(" ", maxTextLength);
    if (end < maxTextLength / 2) end = maxTextLength;
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1] ?? "")) end--;
    parts.push({ body: remaining.slice(0, end) }); remaining = remaining.slice(end);
  }
  if (remaining) parts.push({ body: remaining });
  if (buttons) {
    const command = buttons[0]!.command.split(" ");
    parts.push({ body: `${buttons.some((button) => button.label === "Confirm") ? "Review all the details above, then use Confirm or Cancel." : "Reply with the missing details, or use Cancel."}\n\nReference: ${command[1]} · version ${command[2]}`, buttons });
  }
  if (parts.length > 20) throw new BadRequestError("This review is too long for one channel conversation. Review it in Panda Agent or send a smaller batch.");
  return parts;
}

import { requestAccessContext } from "../../lib/authorization-request.ts";
import { BadRequestError, ForbiddenError } from "../../lib/errors.ts";
import { messagingService } from "../messaging/service.ts";
import { messagingRepository } from "../messaging/repository.ts";
import { referenceResolver } from "../messaging/references.ts";
import { filterConversations, requireConversationPermission } from "../messaging/permission.ts";
import { readTool, targetFields, idField, textArg } from "./read-tools-support.ts";

export function conversationReadTools() {
  return [readTool("read_conversation", "Read authorized project/workspace conversations, messages, threads, members or pinned messages. Membership and current Messages permission are both required; reading never creates a channel or marks messages read. targetId is the channel ID; messageId identifies a message or thread root.", {
    ...targetFields, messageId: idField,
    view: { type: "string", enum: ["channels", "messages", "message", "thread", "members", "pinned"] },
    before: { type: "string", maxLength: 100 }, limit: { type: "integer", minimum: 1, maximum: 100 },
    search: { type: "string", minLength: 1, maxLength: 500 },
  }, async (context, args) => {
    const service = messagingService(messagingRepository(context.db), { references: referenceResolver(context.db) });
    const scoped = (channel: { projectId: string | null; organizationId: string | null }) =>
      (!channel.projectId || channel.projectId === context.project.id) && (!channel.organizationId || channel.organizationId === context.actor.organizationId);
    const messageId = textArg(args, "messageId");
    const message = messageId ? await service.getMessage(messageId, context.user.id) : null;
    const channelId = textArg(args, "targetId") ?? message?.channelId;
    if (!channelId) {
      if (args.search || (args.view && args.view !== "channels")) throw new BadRequestError("Choose a conversation before reading its messages.");
      const channels = (await service.listChannels(context.user.id)).filter(scoped);
      return filterConversations(context.request, channels);
    }
    const channel = await service.getChannel(channelId, context.user.id);
    if (!scoped(channel) || (message && message.channelId !== channel.id)) throw new ForbiddenError("Choose a conversation in the selected project or workspace.");
    await requireConversationPermission(context.request, channel, "view");
    if (args.view === "members") return service.listMembers(channelId, context.user.id);
    if (args.view === "pinned") return service.listPinned(channelId, context.user.id);
    if (args.view === "message" || args.view === "thread") {
      if (!message) throw new BadRequestError("Choose the message or thread to read.");
      return args.view === "thread" ? service.listThread(message.id, context.user.id) : message;
    }
    const search = textArg(args, "search");
    return search ? service.search(context.user.id, search, channelId, args.limit as number | undefined)
      : service.listMessages(channelId, context.user.id, requestAccessContext(context.request), { before: textArg(args, "before"), limit: args.limit as number | undefined });
  })];
}

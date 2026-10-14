import { serverActionCache } from "@/db/server-action-cache";
import { remoteResult } from "./remote-result";
import { messagingApi } from '@/api/messaging';
import { updatesApi } from '@/api/updates';
import { updatesRepository } from '@/db/updates-repository';
import { requireCurrentAccess } from '@/lib/project-access-store';
import { changes, option, required, type VoiceHandlerMap } from './types';

export const communicationHandlers = {
  async send_message(p, c) {
    await messagingApi.send(required(p.channelId), required(p.body));
    return { queued: false };
  },
  async send_direct_message(p, c) {
    const channel = await messagingApi.openDm(required(p.userId));
    requireCurrentAccess(c.ticket);
    await messagingApi.send(channel.id, required(p.body));
    return { queued: false };
  },
  async reply_message(p, c) {
    const target = option(c, 'replyTargets', p.messageId);
    const message = await messagingApi.message(required(p.messageId));
    requireCurrentAccess(c.ticket);
    if (message.channelId !== target.parentId) throw new Error('This message belongs to a different conversation.');
    await messagingApi.send(message.channelId, required(p.body), message.id);
    return { queued: false };
  },
  async create_project_update(p, c) {
    await updatesRepository.createLocal(c.db, c.projectId, {
      title: required(p.title), description: required(p.description), category: required(p.category),
      stageId: p.stageId, authorName: c.authorName, media: [],
    });
    return { queued: true };
  },
  async edit_project_update(p, c) {
    const patch = changes({ title: p.title, description: p.description });
    await updatesApi.edit(c.projectId, required(p.updateId), patch);
    return remoteResult(() => serverActionCache.update(c.db, c.projectId, required(p.updateId), patch));
  },
  async delete_project_update(p, c) {
    await updatesApi.remove(c.projectId, required(p.updateId));
    return remoteResult(() => serverActionCache.update(c.db, c.projectId, required(p.updateId)));
  },
  async comment_project_update(p, c) {
    await updatesApi.comment(c.projectId, required(p.updateId), required(p.body));
    return { queued: false };
  },
} satisfies Partial<VoiceHandlerMap>;

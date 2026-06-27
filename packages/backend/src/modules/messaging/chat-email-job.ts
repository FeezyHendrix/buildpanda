import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { runNotificationEmail } from "../notifications/email-job.ts";
import { messagingRepository } from "./repository.ts";
import type { NotificationType } from "../notifications/types.ts";

export const CHAT_EMAIL_QUEUE = "chat-email";
export const CHAT_EMAIL_DELAY_MS = 30 * 60 * 1000;

export interface ChatEmailJobData {
  userId: string;
  channelId: string;
  messageCreatedAt: string;
  type: NotificationType;
  title: string;
  projectId: string | null;
}

export async function runChatEmail(db: Knex, data: ChatEmailJobData): Promise<void> {
  // Only email if the recipient still hasn't caught up to the message that
  // triggered this reminder — they've likely seen it in-app otherwise.
  const repo = messagingRepository(db);
  const hasRead = await repo.hasReadSince(data.channelId, data.userId, data.messageCreatedAt);
  if (hasRead) return;

  await runNotificationEmail(db, {
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: "",
    projectId: data.projectId,
    ctaUrl: null,
  });
}

export function registerChatEmailWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<ChatEmailJobData>(CHAT_EMAIL_QUEUE, (jobData) => runChatEmail(db, jobData));
}

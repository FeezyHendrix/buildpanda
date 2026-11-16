import type { FilesService } from "../files/service.ts";
import type { translateAudioToEnglish } from "../../lib/speech.ts";
import type { draftDailyActions } from "./draft.ts";
import type { MessagingAdapterRegistry } from "./channel-types.ts";
import type { MessagingConversationRow, MessagingIdentityRow } from "./types.ts";

export interface MessagingWorkerConnection {
  identity: MessagingIdentityRow;
  conversation: MessagingConversationRow;
}

export interface MessagingWorkerOptions {
  adapters: MessagingAdapterRegistry;
  files?: Pick<FilesService, "upload" | "readBytes">;
  translate?: typeof translateAudioToEnglish;
  draft?: typeof draftDailyActions;
  now?: () => Date;
}

export type MessagingWorkerDependencies = Required<MessagingWorkerOptions>;

export const MESSAGING_HELP = "Send a daily site note or daily-log header update as text or a voice note. Panda drafts it for your review before saving. Connect your account and choose the project/building in Panda Agent. Reply STOP to opt out; reconnect in the app to resume. Other field actions are not enabled yet.";

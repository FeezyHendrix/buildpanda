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


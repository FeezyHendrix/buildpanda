import { collaborationMessagingHandlers } from "./collaboration-messaging.ts";
import { collaborationUpdateHandlers } from "./collaboration-updates.ts";
import { collaborationDocumentHandlers } from "./collaboration-documents.ts";
import { collaborationDrawingHandlers } from "./collaboration-drawings.ts";
import type { CollaborationPayloads } from "./collaboration-types.ts";
import type { FieldToolHandler } from "./tool-types.ts";

export { collaborationSchemas } from "./collaboration-schemas.ts";
export { collaborationRequirements } from "./collaboration-requirements.ts";
export const collaborationHandlers = {
  ...collaborationMessagingHandlers, ...collaborationUpdateHandlers,
  ...collaborationDocumentHandlers, ...collaborationDrawingHandlers,
} satisfies Record<keyof CollaborationPayloads, FieldToolHandler>;

import type { CollaborationPayloads } from "./collaboration-types.ts";
import type { FieldToolRequirement } from "./tool-types.ts";

const messaging = { features: ["collaboration.messaging"], permissions: [["messages", "view"], ["messages", "send"]], permissionScope: "either" } as const;
const updates = { features: ["project.updates"], permissions: [["updates", "post"]] } as const;
const upload = { features: ["projects.documents"], permissions: [["documents", "upload"]] } as const;
const view = { features: ["projects.documents"], permissions: [["documents", "view"]] } as const;
const markup = { features: ["projects.documents"], permissions: [["documents", "view"], ["documents", "markup"]] } as const;

/** Base availability; conversation scope, view permission, membership and state stay target-specific. */
export const collaborationRequirements = {
  send_message: messaging,
  send_direct_message: { features: ["collaboration.messaging"], permissions: [["messages", "view"], ["messages", "send"]], permissionScope: "workspace" },
  reply_message: messaging,
  create_project_update: updates, edit_project_update: updates, delete_project_update: updates,
  comment_project_update: { features: ["project.updates"], permissions: [["updates", "view"], ["comments", "post"]] },
  upload_document: upload, rename_document: upload, upload_document_version: upload,
  download_document: view, open_document: view,
  delete_document: { features: ["projects.documents"], permissions: [["documents", "delete"]] },
  annotate_drawing: markup, comment_drawing: markup, resolve_drawing: markup, delete_drawing: markup,
} as const satisfies Record<keyof CollaborationPayloads, FieldToolRequirement>;

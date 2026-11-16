import { config } from "../../config/index.ts";
import type { MessagingDocumentArtifact } from "./management-types.ts";
import type { MessagingActionRow } from "./types.ts";

/** Only successful, authorized document reads can expose a view target. */
export function messagingDocumentArtifacts(actions: MessagingActionRow[]): MessagingDocumentArtifact[] {
  return actions.flatMap((action) => {
    if (!["open_document", "download_document"].includes(action.kind) || action.status !== "committed") return [];
    const data = action.result?.data as Record<string, unknown> | undefined;
    if (!data || typeof data.documentId !== "string" || typeof data.versionId !== "string" || action.result?.recordId !== data.documentId || typeof action.result.projectId !== "string") return [];
    const projectId = action.result.projectId, documentId = data.documentId, versionId = data.versionId;
    const apiPath = `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/view`;
    const download = action.kind === "download_document";
    const url = new URL(config.messagingAgent.portalUrl || `${config.auth.baseUrl.replace(/\/$/, "")}${apiPath}`);
    if (config.messagingAgent.portalUrl) {
      url.searchParams.set("projectId", projectId); url.searchParams.set("documentId", documentId); url.searchParams.set("versionId", versionId);
      if (download) url.searchParams.set("download", "1");
    }
    return [{ kind: "document", projectId, documentId, versionId, fileName: typeof data.fileName === "string" ? data.fileName : "Document", mimeType: typeof data.mimeType === "string" ? data.mimeType : "application/octet-stream", apiPath, url: url.toString(), download }];
  });
}

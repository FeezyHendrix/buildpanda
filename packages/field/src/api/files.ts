import type { AccessRequirement } from "@/lib/access-requirement";
import { messagingAccess, uploadAccess } from "@/lib/feature-access";
import { projectAccess, requireAccess, requireCurrentAccess, revokeProjectAccess } from "@/lib/project-access-store";
import { API_BASE_URL } from "@/lib/auth-client";
import { ApiError, request } from "./client";
import { isAccessRejection, responseError } from "./error";
export interface UploadedFile {
    readonly id: string;
    readonly fileName: string;
    readonly sizeBytes: number;
}
export async function verifyMessageAttachment(fileId: string): Promise<void> {
    const ticket = requireAccess(projectAccess.getState().scope?.projectId ?? "", messagingAccess);
    try {
        await request(`/files/${encodeURIComponent(fileId)}`);
        requireCurrentAccess(ticket);
    }
    catch (error) {
        requireCurrentAccess(ticket);
        if (error instanceof ApiError && isAccessRejection(error))
            revokeProjectAccess();
        throw error;
    }
}
export async function uploadProjectFile(projectId: string, uri: string, fileName: string, mimeType: string, permission: AccessRequirement = uploadAccess): Promise<UploadedFile> {
    const ticket = requireAccess(projectId, permission);
    const headers: Record<string, string> = {};
    {
        if (!/^(blob:|data:)/.test(uri))
            throw new Error("Choose a file from this browser first.");
        const blob = await fetch(uri).then((response) => response.blob());
        requireCurrentAccess(ticket);
        const form = new FormData();
        form.append("projectId", projectId);
        form.append("file", blob, fileName);
        const response = await fetch(`${API_BASE_URL}/files`, { method: "POST", credentials: "include", body: form });
        requireCurrentAccess(ticket);
        if (!response.ok) {
            const error = responseError(response.status, await response.text().catch(() => null), `Upload failed (${response.status})`);
            requireCurrentAccess(ticket);
            if (isAccessRejection(error))
                revokeProjectAccess();
            throw error;
        }
        return response.json() as Promise<UploadedFile>;
    }
}

import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";
import { features } from "@/lib/feature-access";
import { requireAccess, requireCurrentAccess, revokeProjectAccess } from "@/lib/project-access-store";
import { isAccessRejection, responseError } from "./error";
import { uploadRecording } from "./voice-upload";

export async function transcribeUpdateComment(projectId: string, updateId: string, uri: string, signal: AbortSignal): Promise<string> {
  const ticket = requireAccess(projectId, features.updates.actions.comment);
  const headers: Record<string, string> = Platform.OS === "web" ? {} : { cookie: authClient.getCookie() };
  const result = await uploadRecording(`${API_BASE_URL}/projects/${projectId}/updates/${updateId}/comments/transcribe`, uri, headers, signal);
  requireCurrentAccess(ticket);
  if (result.status < 200 || result.status >= 300) {
    const error = responseError(result.status, result.body, "Could not convert this voice note to text.");
    if (isAccessRejection(error)) revokeProjectAccess();
    throw error;
  }
  const response = JSON.parse(result.body) as { formatted: string };
  return response.formatted;
}

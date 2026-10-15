import { canAccess, requireAccess, requireCurrentAccess, revokeProjectAccess } from "@/lib/project-access-store";
import { captureAccess } from "@/lib/feature-access";
import { voiceRequirement } from "@/lib/voice-access";
import { uploadRecording } from "./voice-upload";
import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";
import type { VoiceReport } from "./voice-report-types";
import { isAccessRejection, responseError } from "./error";

/**
 * Uploads a recording to Panda AI, which transcribes it (Whisper) and returns
 * the field records it thinks the crew member is asking to create.
 *
 * Multipart, so it can't go through the JSON `request()` helper — mirrors
 * `documentsApi.uploadFile`. This is one of the few online-only actions: the
 * audio has to reach the model, so the caller guards on connectivity.
 */
export async function requestVoiceReport(
  projectId: string,
  audioUri: string,
  signal?: AbortSignal,
): Promise<VoiceReport> {
  const ticket = requireAccess(projectId, captureAccess);
  const headers: Record<string, string> = {};
  if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

  const result = await uploadRecording(`${API_BASE_URL}/projects/${projectId}/ai/voice-report`, audioUri, headers, signal);

  requireCurrentAccess(ticket);
  if (result.status < 200 || result.status >= 300) {
    const error = responseError(result.status, result.body, `Panda AI could not process that recording (${result.status}).`);
    if (isAccessRejection(error)) revokeProjectAccess();
    throw error;
  }

  const report = JSON.parse(result.body) as VoiceReport;
  return { ...report, actions: report.actions.filter((action) => canAccess(projectId, voiceRequirement(action))) };
}

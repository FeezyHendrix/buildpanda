import { FileSystemUploadType, createUploadTask } from "expo-file-system/legacy";
import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";
import type { VoiceReport } from "./voice-report-types";

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
  const headers: Record<string, string> = {};
  if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

  // Native multipart upload: React Native's FormData rejects the recording's file
  // part ("unsupported FormDataPart implementation"), so expo-file-system streams
  // the file straight from disk instead of building a FormData body.
  const upload = createUploadTask(
    `${API_BASE_URL}/projects/${projectId}/ai/voice-report`,
    audioUri,
    {
      httpMethod: "POST",
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: "audio",
      mimeType: "audio/m4a",
      headers,
    },
  );

  let timedOut = false;
  const cancel = () => { void upload.cancelAsync().catch(() => undefined); };
  if (signal?.aborted) throw new Error("Recording processing was cancelled.");
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; cancel(); }, 120_000);
  let result;
  try {
    result = await upload.uploadAsync();
  } catch (error) {
    if (timedOut) throw new Error("Processing timed out. Your recording is still available to retry.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
  if (timedOut) throw new Error("Processing timed out. Your recording is still available to retry.");
  if (!result || signal?.aborted) throw new Error("Recording processing was cancelled.");

  if (result.status < 200 || result.status >= 300) {
    let message = `Panda AI could not process that recording (${result.status}).`;
    try {
      const parsed = JSON.parse(result.body) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      // error body was not JSON; keep the generic message
    }
    throw new Error(message);
  }

  return JSON.parse(result.body) as VoiceReport;
}

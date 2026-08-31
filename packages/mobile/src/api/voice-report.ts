import { FileSystemUploadType, uploadAsync } from "expo-file-system/legacy";
import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";
import type { UpsertChangeRequestInput } from "./change-requests";
import type { CreateLookAheadInput } from "./look-aheads";
import type { CreateMaterialOrderInput } from "./materials";
import type { UpsertRfiInput } from "./rfis";

/**
 * A single record Panda AI proposes creating from a spoken site update. Every
 * one is reviewed by the crew member before anything is written — voice never
 * creates a contractual record silently.
 *
 * `kind` maps one-to-one onto the offline create repositories, so a confirmed
 * action is enqueued to the outbox exactly like a hand-typed one and survives a
 * dead signal.
 */
export type ProposedAction =
  | { kind: "rfi"; title: string; summary: string; payload: UpsertRfiInput }
  | { kind: "daily_log"; title: string; summary: string; payload: { bodyText: string } }
  | { kind: "change_request"; title: string; summary: string; payload: UpsertChangeRequestInput }
  | { kind: "material_order"; title: string; summary: string; payload: CreateMaterialOrderInput }
  | { kind: "look_ahead"; title: string; summary: string; payload: CreateLookAheadInput };

export type ProposedActionKind = ProposedAction["kind"];

export interface VoiceReport {
  /** The English transcript Panda AI worked from, shown so the crew can sanity-check it. */
  transcript: string;
  actions: ProposedAction[];
}

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
): Promise<VoiceReport> {
  const headers: Record<string, string> = {};
  if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

  // Native multipart upload: React Native's FormData rejects the recording's file
  // part ("unsupported FormDataPart implementation"), so expo-file-system streams
  // the file straight from disk instead of building a FormData body.
  const result = await uploadAsync(
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

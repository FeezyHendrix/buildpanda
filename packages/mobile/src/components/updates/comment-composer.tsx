import { hasRichContent, htmlFromText, MAX_VOICE_NOTE_SECONDS } from "@buildpanda/rich-content";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { transcribeUpdateComment } from "@/api/update-comment-transcription";
import { Button, Text } from "@/components/atoms";
import { VoiceNote, type CapturedAudio } from "@/components/molecules/voice-note";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { NewLocalUpdateComment } from "@/db/update-comments-repository";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { features } from "@/lib/feature-access";
import { htmlToText } from "@/lib/html";
import { requireAccess, requireCurrentAccess } from "@/lib/project-access-store";
import { readCachedUser } from "@/lib/session-cache";
import { useSyncState } from "@/lib/sync-provider";

export function CommentComposer({ projectId, updateId, onPost }: {
  projectId: string; updateId: string; onPost: (input: NewLocalUpdateComment) => Promise<void>;
}) {
  const recorder = useVoiceRecorder();
  const { isOnline } = useSyncState();
  const [html, setHtml] = useState("");
  const [audio, setAudio] = useState<CapturedAudio | null>(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState(false);
  const [error, setError] = useState("");
  const transcription = useRef<AbortController | null>(null);
  const posting = useRef(false);
  useEffect(() => () => transcription.current?.abort(), []);
  const length = htmlToText(html).length;
  const live = recorder.isRecording || recorder.isPaused;
  const validAudio = !audio || (audio.durationSeconds >= 1 && audio.durationSeconds <= MAX_VOICE_NOTE_SECONDS);
  const canPost = !live && !saving && !converting && validAudio && length <= 2000 && html.length <= 200000 && (hasRichContent(html) || !!audio);

  async function convert() {
    if (!audio || converting || !isOnline) return;
    const ticket = requireAccess(projectId, features.updates.actions.comment);
    const controller = new AbortController();
    transcription.current = controller;
    setConverting(true);
    setError("");
    try {
      const text = await transcribeUpdateComment(projectId, updateId, audio.uri, controller.signal);
      requireCurrentAccess(ticket);
      if (controller.signal.aborted) return;
      setHtml((current) => `${current}${htmlFromText(text)}`);
      setConverted(true);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not convert this voice note."); }
    finally { if (!controller.signal.aborted) setConverting(false); }
  }
  async function post() {
    if (!canPost || posting.current) return;
    posting.current = true;
    setSaving(true);
    setError("");
    try {
      await onPost({ bodyHtml: html, authorName: readCachedUser()?.name ?? "You",
        audio: audio ? { ...audio, mimeType: Platform.OS === "web" ? "audio/webm" : "audio/m4a" } : null });
      setHtml(""); setAudio(null); setConverted(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this comment."); }
    finally { posting.current = false; setSaving(false); }
  }
  return <View className="gap-3 rounded-2xl border border-hairline bg-surface p-4">
    <Text weight="semibold">Add a comment</Text>
    <RichTextEditor label="Comment" value={html} onChange={setHtml} projectId={projectId} placeholder="Write a comment or add photos…" editable={!saving} compact />
    <View pointerEvents={saving || converting ? "none" : "auto"}>
      <VoiceNote recorder={{ ...recorder, start: async () => { requireAccess(projectId, features.updates.actions.comment); await recorder.start(); } }}
        captured={audio} onCaptured={(value) => { setAudio(value); setConverted(false); }}
        onDiscard={() => { setAudio(null); setConverted(false); void recorder.discard(); }} maxDurationSeconds={MAX_VOICE_NOTE_SECONDS} />
    </View>
    {audio ? <View className="gap-2">
      <Button variant="secondary" onPress={() => void convert()} loading={converting}
        disabled={!validAudio || !isOnline || saving || converted || updateId.startsWith("local_")}>
        {converted ? "Text added for review" : "Convert to text"}
      </Button>
      <Text tone="secondary" className="text-xs">{!isOnline ? "You can post the recording offline. Connect to convert it to text." : updateId.startsWith("local_") ? "Text conversion is available once the update has uploaded." : "The recording stays playable. Review any converted text before posting."}</Text>
    </View> : <Text tone="secondary" className="text-xs">Voice notes can be up to 5 minutes.</Text>}
    {!validAudio ? <Text tone="danger">Record between 1 second and 5 minutes.</Text> : null}
    {length > 2000 ? <Text tone="danger">Keep your comment within 2,000 characters ({length}/2,000).</Text> : null}
    {error || recorder.error ? <Text tone="danger">{error || recorder.error}</Text> : null}
    <Button permission={features.updates.actions.comment} disabled={!canPost} loading={saving} onPress={() => void post()}>
      {isOnline ? "Post comment" : "Queue comment"}
    </Button>
  </View>;
}

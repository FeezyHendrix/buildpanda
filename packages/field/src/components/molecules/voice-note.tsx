import Ionicons from "@/components/atoms/icon";
import { AudioPlayer } from "./audio-player";
import { useEffect, useRef } from "react";
import { Text } from "@/components/atoms";
import { ICON_DEFAULT, ICON_INVERSE } from "@/constants/colors";
import type { VoiceRecorder } from "@/hooks/use-voice-recorder";
// A voice note recorded on site is often the only record of what someone saw.
// Recording it blind — no level, no playback, no pause — gives no reason to
// believe it worked, which is why notes get re-recorded or quietly lost.
const BARS = 14;
export interface CapturedAudio {
    uri: string;
    durationSeconds: number;
}
function clock(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    return `${m}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
/** A live level meter, so a dead mic is obvious while there is still time. */
function LevelMeter({ level, active }: {
    level: number;
    active: boolean;
}) { return <meter min={0} max={1} value={active ? level : 0} aria-label="Microphone level" className="h-8 flex-1"/>; }
LevelMeter.displayName = "LevelMeter";
/** Record, watch the level, pause, then hear it back before sending. */
export function VoiceNote({ recorder, captured, onCaptured, onDiscard, maxDurationSeconds, }: {
    recorder: VoiceRecorder;
    captured: CapturedAudio | null;
    onCaptured: (audio: CapturedAudio) => void;
    onDiscard: () => void;
    maxDurationSeconds?: number;
}) {
    const stopping = useRef(false);
    useEffect(() => {
        if (!maxDurationSeconds || recorder.seconds < maxDurationSeconds || !recorder.isRecording || stopping.current)
            return;
        stopping.current = true;
        void recorder.stop().then((audio) => {
            if (audio)
                onCaptured(audio);
        }).finally(() => { stopping.current = false; });
    }, [maxDurationSeconds, recorder.seconds, recorder.isRecording, recorder.stop, onCaptured]);
    if (captured)
        return <div className="field-stack gap-2"><AudioPlayer uri={captured.uri} durationSeconds={captured.durationSeconds}/>
    <button role="button" aria-label="Remove voice note" onClick={onDiscard} className="min-h-11 justify-center px-3" type="button">
      <Text tone="danger">Remove voice note</Text>
    </button></div>;
    const live = recorder.isRecording || recorder.isPaused;
    return (<div className="field-stack gap-2 rounded-xl border border-hairline px-3 py-2">
      <div className="field-stack flex-row items-center gap-3">
        <button onClick={() => {
            if (!live) {
                void recorder.start();
                return;
            }
            void recorder.stop().then((result) => {
                if (result)
                    onCaptured(result);
            });
        }} role="button" aria-label={live ? "Stop recording" : "Record a voice note"} className={`h-11 w-11 items-center justify-center rounded-full ${live ? "bg-error-500" : "bg-primary-500"}`} type="button">
          <Ionicons name={live ? "stop" : "mic"} size={18} color={ICON_INVERSE}/>
        </button>

        {live ? <LevelMeter level={recorder.level} active={recorder.isRecording}/> : (<Text tone="secondary" className="flex-1 text-[13px]">
            Record a voice note
          </Text>)}

        {live ? (<button onClick={() => (recorder.isPaused ? recorder.resume() : recorder.pause())} role="button" aria-label={recorder.isPaused ? "Resume recording" : "Pause recording"} className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt" type="button">
            <Ionicons name={recorder.isPaused ? "play" : "pause"} size={18} color={ICON_DEFAULT}/>
          </button>) : null}
      </div>

      {live ? (<Text tone="secondary" className="text-center text-[11px] tabular-nums">
          {recorder.isPaused ? `Paused · ${clock(recorder.seconds)}` : clock(recorder.seconds)}
        </Text>) : null}
    </div>);
}
VoiceNote.displayName = "VoiceNote";

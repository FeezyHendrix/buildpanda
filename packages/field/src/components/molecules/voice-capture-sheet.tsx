import Ionicons from "@/components/atoms/icon";
import { useEffect, useRef } from "react";
import { Modal } from "@/platform/browser";
import { useSafeAreaInsets } from "@/platform/safe-area";
import { Text } from "@/components/atoms";
import { ICON_BRAND, ICON_DEFAULT, ICON_STRONG } from "@/constants/colors";
import { useVoiceRecorder, type Recording } from "@/hooks/use-voice-recorder";
// Recording is a moment, not a destination. Speaking about what just happened
// on site should not cost a screen transition and the loss of whatever you
// were looking at, so the recorder rises over the current screen. The page
// comes after, when there are drafts to read.
const BARS = 24;
const IDLE_HEIGHT = 4;
const MAX_HEIGHT = 44;
function clock(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    return `${m}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
/** A waveform that scrolls as you speak, so the mic is visibly listening. */
function Waveform({ level, active }: {
    level: number;
    active: boolean;
}) { return <meter min={0} max={1} value={active ? level : 0} aria-label="Microphone level" className="h-12 w-full"/>; }
function RecordButton({ live, onPress }: {
    level: number;
    live: boolean;
    onPress: () => void;
}) { return <button type="button" onClick={onPress} aria-label={live ? 'Stop recording' : 'Start recording'} className={`h-20 w-20 rounded-full text-white ${live ? 'bg-error-500' : 'bg-primary-500'}`}><Ionicons name={live ? 'stop' : 'mic'} size={32}/></button>; }
/**
 * Rises over whatever is on screen, records, and hands the finished audio back.
 * It never navigates; the caller decides what to do with the recording.
 */
export function VoiceCaptureSheet({ visible, onClose, onRecorded, }: {
    visible: boolean;
    onClose: () => void;
    onRecorded: (recording: Recording) => void;
}) {
    const insets = useSafeAreaInsets();
    const recorder = useVoiceRecorder();
    const finishing = useRef(false);
    const live = recorder.isRecording || recorder.isPaused;
    // opening the sheet starts listening: the tap on the mic was the intent
    useEffect(() => {
        if (visible)
            void recorder.start();
    }, [visible]);
    async function finish() {
        if (finishing.current)
            return;
        finishing.current = true;
        try {
            const recording = await recorder.stop();
            if (!recording)
                return;
            if (recording.durationSeconds < 1) {
                onClose();
                return;
            }
            onRecorded(recording);
        }
        finally {
            finishing.current = false;
        }
    }
    function cancel() {
        void recorder.discard();
        onClose();
    }
    return (<Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <button onClick={cancel} aria-label="Dismiss" className="flex-1 bg-black-900/40" type="button"/>
      <div className="field-stack rounded-t-3xl bg-surface px-5 pt-3" style={{ paddingBottom: insets.bottom + 20 }}>
        <div className="field-stack items-center">
          <div className="field-stack h-1 w-10 rounded-full bg-grey-100"/>
        </div>

        <div className="field-stack flex-row items-center pt-3">
          <Text weight="bold" className="flex-1 text-lg">
            {recorder.isPaused ? "Paused" : live ? "Listening…" : "Voice note"}
          </Text>
          <button onClick={cancel} role="button" aria-label="Cancel recording" className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt" type="button">
            <Ionicons name="close" size={22} color={ICON_STRONG}/>
          </button>
        </div>

        <Text tone="secondary" className="pb-2 text-[13px]">
          Describe what happened on site. Panda AI drafts the records for you to review.
        </Text>

        <Waveform level={recorder.level} active={recorder.isRecording}/>

        <Text weight="bold" className="pb-4 text-center text-3xl tabular-nums">
          {clock(recorder.seconds)}
        </Text>

        <div className="field-stack flex-row items-center justify-center gap-8">
          <button onClick={() => (recorder.isPaused ? recorder.resume() : recorder.pause())} disabled={!live} role="button" aria-label={recorder.isPaused ? "Resume" : "Pause"} className={`h-14 w-14 items-center justify-center rounded-full bg-surface-alt ${live ? "" : "opacity-40"}`} type="button">
            <Ionicons name={recorder.isPaused ? "play" : "pause"} size={22} color={ICON_DEFAULT}/>
          </button>

          <RecordButton level={recorder.level} live={live} onPress={() => (live ? void finish() : void recorder.start())}/>

          <button onClick={() => void finish()} disabled={!live || recorder.seconds < 1} role="button" aria-label="Finish and review" className={`h-14 w-14 items-center justify-center rounded-full bg-primary-50 ${live && recorder.seconds >= 1 ? "" : "opacity-40"}`} type="button">
            <Ionicons name="arrow-forward" size={22} color={ICON_BRAND}/>
          </button>
        </div>

        {recorder.error ? (<Text tone="danger" className="pt-3 text-center text-xs">
            {recorder.error}
          </Text>) : null}
      </div>
    </Modal>);
}
VoiceCaptureSheet.displayName = "VoiceCaptureSheet";

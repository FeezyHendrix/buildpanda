import { useEffect, useRef, useState } from "react";
import { type Pt } from "./plan-review-data";
import { PLAYBACK_SECONDS, REC_STATUS, type RecStatus } from "./plan-review-types";

/** Sample the pointer at most every {@link TRACE_INTERVAL_MS} and cap the buffer at {@link TRACE_MAX_POINTS}. */
const TRACE_INTERVAL_MS = 50;
const TRACE_MAX_POINTS = 500;
const SAVED_FLASH_MS = 4000;

interface RecordingClient {
  /** Locate a point in sheet-percentage space; returns null when the canvas is not mounted. */
  pointFromEvent: (e: { clientX: number; clientY: number }) => Pt | null;
  /** Runs when a new take starts — clear any prior recording note here. */
  onStart: () => void;
  /** Runs when a take is saved — append the recording note here (caller owns the active sheet). */
  onStop: (durationSeconds: number) => void;
  /** Runs when a take is discarded — remove the recording note here. */
  onClear: () => void;
}

export interface RecordingController {
  status: RecStatus;
  seconds: number;
  trace: Pt[];
  savedFlash: boolean;
  playProgress: number | null;
  visibleTrace: Pt[];
  traceTip: Pt | undefined;
  start: () => void;
  stop: () => void;
  clear: () => void;
  play: () => void;
  captureTrace: (e: { clientX: number; clientY: number }) => void;
}

/**
 * Walkthrough recording: a timed take that captures the reviewer's pointer path
 * over the sheet and can replay it. State, timers and the trace buffer live here;
 * the owning page keeps the notes list and wires it through the callbacks.
 */
export function usePlanRecording(client: RecordingClient): RecordingController {
  const [status, setStatus] = useState<RecStatus>(REC_STATUS.IDLE);
  const [seconds, setSeconds] = useState(0);
  const [trace, setTrace] = useState<Pt[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [playProgress, setPlayProgress] = useState<number | null>(null);
  const lastTraceAt = useRef(0);
  const playTimer = useRef<number | null>(null);

  useEffect(() => {
    if (status !== REC_STATUS.RECORDING) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(
    () => () => {
      if (playTimer.current !== null) window.clearInterval(playTimer.current);
    },
    [],
  );

  function start(): void {
    client.onStart();
    setPlayProgress(null);
    setTrace([]);
    setSeconds(0);
    setStatus(REC_STATUS.RECORDING);
  }

  function stop(): void {
    setStatus(REC_STATUS.SAVED);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), SAVED_FLASH_MS);
    client.onStop(seconds);
  }

  function clear(): void {
    if (playTimer.current !== null) window.clearInterval(playTimer.current);
    client.onClear();
    setStatus(REC_STATUS.IDLE);
    setPlayProgress(null);
    setTrace([]);
    setSeconds(0);
  }

  function play(): void {
    if (trace.length === 0 || playProgress !== null) return;
    const steps = (PLAYBACK_SECONDS * 1000) / TRACE_INTERVAL_MS;
    let step = 0;
    setPlayProgress(0);
    playTimer.current = window.setInterval(() => {
      step += 1;
      if (step >= steps) {
        if (playTimer.current !== null) window.clearInterval(playTimer.current);
        playTimer.current = null;
        setPlayProgress(null);
      } else {
        setPlayProgress(step / steps);
      }
    }, TRACE_INTERVAL_MS);
  }

  function captureTrace(e: { clientX: number; clientY: number }): void {
    if (status !== REC_STATUS.RECORDING) return;
    const now = Date.now();
    if (now - lastTraceAt.current < TRACE_INTERVAL_MS) return;
    lastTraceAt.current = now;
    const tracePoint = client.pointFromEvent(e);
    if (tracePoint) {
      setTrace((t) => (t.length >= TRACE_MAX_POINTS ? [...t.slice(1), tracePoint] : [...t, tracePoint]));
    }
  }

  const visibleTrace =
    playProgress === null ? trace : trace.slice(0, Math.max(2, Math.floor(trace.length * playProgress)));
  const traceTip = visibleTrace[visibleTrace.length - 1];

  return {
    status,
    seconds,
    trace,
    savedFlash,
    playProgress,
    visibleTrace,
    traceTip,
    start,
    stop,
    clear,
    play,
    captureTrace,
  };
}

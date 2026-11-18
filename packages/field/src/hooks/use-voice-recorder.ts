import { useCallback, useEffect, useRef, useState } from 'react';
export interface Recording {
    uri: string;
    durationSeconds: number;
}
export function useVoiceRecorder() {
    const [state, setState] = useState({ isRecording: false, isPaused: false, seconds: 0, level: 0, error: null as string | null });
    const session = useRef<{
        recorder: MediaRecorder;
        stream: MediaStream;
        context: AudioContext;
        analyser: AnalyserNode;
        chunks: Blob[];
        started: number;
        elapsed: number;
        timer: ReturnType<typeof setInterval>;
    } | null>(null);
    const generation = useRef(0);
    const starting = useRef(false);
    const release = useCallback(() => { const current = session.current; session.current = null; if (!current)
        return; clearInterval(current.timer); current.stream.getTracks().forEach(track => track.stop()); void current.context.close().catch(() => undefined); }, []);
    const start = useCallback(async () => {
        if (starting.current || session.current)
            return;
        starting.current = true;
        const attempt = ++generation.current;
        setState({ isRecording: false, isPaused: false, seconds: 0, level: 0, error: null });
        let stream: MediaStream | undefined;
        let context: AudioContext | undefined;
        try {
            context = new AudioContext();
            // Autoplay may suspend metering; it must not block microphone capture.
            void context.resume().catch(() => undefined);
            stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
            if (attempt !== generation.current) {
                stream.getTracks().forEach(track => track.stop());
                void context.close().catch(() => undefined);
                return;
            }
            const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
            const recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            context.createMediaStreamSource(stream).connect(analyser);
            const samples = new Uint8Array(analyser.fftSize);
            const chunks: Blob[] = [];
            recorder.ondataavailable = event => { if (event.data.size)
                chunks.push(event.data); };
            const timer = setInterval(() => { const live = session.current; if (!live)
                return; analyser.getByteTimeDomainData(samples); const rms = Math.sqrt(samples.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / samples.length); const elapsed = live.elapsed + (recorder.state === 'recording' ? performance.now() - live.started : 0); setState(prev => ({ ...prev, seconds: Math.floor(elapsed / 1000), level: Math.min(1, rms * 5) })); }, 100);
            session.current = { recorder, stream, context, analyser, chunks, started: performance.now(), elapsed: 0, timer };
            recorder.onstop = () => {
                if (attempt !== generation.current) return;
                release();
                setState(prev => ({ ...prev, isRecording: false, isPaused: false, level: 0 }));
            };
            recorder.onerror = () => {
                if (attempt !== generation.current) return;
                release();
                setState(prev => ({ ...prev, isRecording: false, isPaused: false, level: 0, error: 'Microphone capture stopped. Please record it again.' }));
            };
            recorder.start();
            setState(prev => ({ ...prev, isRecording: true }));
        }
        catch (error) {
            if (attempt === generation.current) release();
            stream?.getTracks().forEach(track => track.stop());
            void context?.close().catch(() => undefined);
            if (attempt === generation.current)
                setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Could not start the microphone.' }));
        }
        finally {
            starting.current = false;
        }
    }, [release]);
    const pause = () => { const current = session.current; if (current?.recorder.state === 'recording') {
        current.elapsed += performance.now() - current.started;
        current.recorder.pause();
        setState(prev => ({ ...prev, isRecording: false, isPaused: true }));
    } };
    const resume = () => { const current = session.current; if (current?.recorder.state === 'paused') {
        current.started = performance.now();
        void current.context.resume().catch(() => undefined);
        current.recorder.resume();
        setState(prev => ({ ...prev, isRecording: true, isPaused: false }));
    } };
    const stop=async():Promise<Recording|null>=>{
        const current=session.current;if(!current)return null;
        const attempt=generation.current;
        const elapsed=current.elapsed+(current.recorder.state==='recording'?performance.now()-current.started:0);
        return new Promise(resolve=>{
            const failed=()=>{if(attempt!==generation.current){resolve(null);return;}release();setState(prev=>({...prev,isRecording:false,isPaused:false,level:0,error:'Could not finish this recording. Please record it again.'}));resolve(null);};
            current.recorder.onstop=()=>{if(attempt!==generation.current){resolve(null);return;}const blob=new Blob(current.chunks,{type:current.recorder.mimeType});release();setState(prev=>({...prev,isRecording:false,isPaused:false,level:0}));resolve(blob.size?{uri:URL.createObjectURL(blob),durationSeconds:Math.floor(elapsed/1000)}:null);};
            current.recorder.onerror=failed;
            try{current.recorder.stop();}catch{failed();}
        });
    };
    const discard = useCallback(async () => { ++generation.current; const current = session.current; if (current && current.recorder.state !== 'inactive')
        current.recorder.stop(); release(); setState(prev => ({ ...prev, isRecording: false, isPaused: false, level: 0 })); }, [release]);
    useEffect(() => () => { ++generation.current; const current = session.current; if (current && current.recorder.state !== 'inactive')
        current.recorder.stop(); release(); }, [release]);
    return { ...state, start, pause, resume, stop, discard };
}

export type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;

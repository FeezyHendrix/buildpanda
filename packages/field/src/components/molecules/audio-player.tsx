import { useEffect, useRef } from 'react';
export function audioTime(seconds: number) { const total = Math.max(0, Math.floor(seconds)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; }
export function AudioPlayer({ uri }: {
    uri: string;
    durationSeconds: number;
}) { const ref = useRef<HTMLAudioElement>(null); useEffect(() => { const audio = ref.current; return () => { audio?.pause(); audio?.removeAttribute('src'); }; }, [uri]); return <audio ref={ref} src={uri} controls preload="metadata" aria-label="Voice note" className="w-full"/>; }

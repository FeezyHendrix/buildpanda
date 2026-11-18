import { useEffect, useRef, useState } from 'react';
export function useAudioPlayer(source?: {
    uri: string;
}) { const ref = useRef<HTMLAudioElement | null>(null); if (!ref.current)
    ref.current = new Audio(source?.uri); const audio = ref.current; useEffect(() => () => { audio.pause(); audio.src = ''; }, [audio]); return { audio, pause: () => audio.pause(), play: () => { void audio.play(); }, replace: (uri: string) => { audio.src = uri; }, seekTo: async (seconds: number) => { audio.currentTime = seconds; } }; }
export function useAudioPlayerStatus(player: ReturnType<typeof useAudioPlayer>) { const [state, setState] = useState({ playing: false, currentTime: 0, duration: 0, didJustFinish: false }); useEffect(() => { const audio = player.audio; const update = () => setState({ playing: !audio.paused, currentTime: audio.currentTime, duration: audio.duration || 0, didJustFinish: audio.ended }); for (const name of ['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata'])
    audio.addEventListener(name, update); return () => { for (const name of ['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata'])
    audio.removeEventListener(name, update); }; }, [player.audio]); return state; }

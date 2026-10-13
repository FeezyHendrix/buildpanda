"use client";

import { useEffect, useRef } from "react";

type LoopVideoProps = { src: string; poster: string; className?: string };

/**
 * A silent, decorative looping video (a lighter stand-in for a GIF). It plays
 * only while it is on screen and the tab is visible, and not at all when the
 * visitor asks for reduced motion: then, and without JavaScript, the poster
 * stays up.
 */
export function LoopVideo({ src, poster, className }: LoopVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let onScreen = false;
    const sync = () => {
      if (onScreen && !document.hidden) void video.play().catch(() => {});
      else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    observer.observe(video);
    document.addEventListener("visibilitychange", sync);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
      className={className}
    />
  );
}

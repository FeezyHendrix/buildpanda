import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/stores/auth";

export interface TourStep {
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
}

function seenKey(tourKey: string, userId: string): string {
  return `buildpanda:tour:${tourKey}:${userId}`;
}

export function clearTourSeen(tourKey: string, userId: string | undefined): void {
  if (!userId) return;
  try {
    localStorage.removeItem(seenKey(tourKey, userId));
  } catch {
    // ignore
  }
}

export function hasSeenTour(tourKey: string, userId: string | undefined): boolean {
  if (!userId) return true;
  try {
    return localStorage.getItem(seenKey(tourKey, userId)) === "1";
  } catch {
    return true;
  }
}

export interface UseTourOptions {
  tourKey: string;
  steps: TourStep[];
  enabled: boolean;
}

export function useTour({ tourKey, steps, enabled }: UseTourOptions) {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled || !userId) return;
    if (hasSeenTour(tourKey, userId)) return;
    setIndex(0);
    setActive(true);
  }, [enabled, userId, tourKey]);

  const markSeen = useCallback(() => {
    if (!userId) return;
    try {
      localStorage.setItem(seenKey(tourKey, userId), "1");
    } catch {
      setActive(false);
    }
  }, [tourKey, userId]);

  const finish = useCallback(() => {
    setActive(false);
    markSeen();
  }, [markSeen]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, finish]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  return {
    active,
    index,
    step: steps[index],
    total: steps.length,
    next,
    back,
    skip: finish,
  };
}

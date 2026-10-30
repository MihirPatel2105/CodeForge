"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { reduceRun, type RunSnapshot } from "./run-reducer";
import type { CodeForgeEvent } from "./types";

export interface DemoPlaybackOptions {
  intervalMs: number;
  /** Start advancing as soon as nothing holds playback. */
  autoplay?: boolean;
  /** Hold playback without changing whether it is paused, e.g. while off screen. */
  held?: boolean;
}

export interface DemoPlayback {
  eventIndex: number;
  snapshot: RunSnapshot;
  playing: boolean;
  isComplete: boolean;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  replay: () => void;
  skipToEnd: () => void;
}

/** Steps a scripted event list through the product's own reducer, one event per tick. */
export function useDemoPlayback(
  events: CodeForgeEvent[],
  { intervalMs, autoplay = true, held = false }: DemoPlaybackOptions,
): DemoPlayback {
  const [eventIndex, setEventIndex] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const lastEventIndex = events.length - 1;
  const isComplete = eventIndex >= lastEventIndex;

  const snapshot = useMemo(() => reduceRun(events.slice(0, eventIndex + 1)), [events, eventIndex]);

  useEffect(() => {
    if (!playing || held || isComplete) return;
    const timer = window.setTimeout(() => setEventIndex((current) => current + 1), intervalMs);
    return () => window.clearTimeout(timer);
  }, [eventIndex, held, intervalMs, isComplete, playing]);

  useEffect(() => {
    if (isComplete) setPlaying(false);
  }, [isComplete]);

  const replay = useCallback(() => {
    setEventIndex(0);
    setPlaying(true);
  }, []);

  const skipToEnd = useCallback(() => {
    setEventIndex(lastEventIndex);
    setPlaying(false);
  }, [lastEventIndex]);

  return { eventIndex, snapshot, playing, isComplete, setPlaying, replay, skipToEnd };
}

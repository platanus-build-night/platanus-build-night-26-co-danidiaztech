import { useCallback, useEffect, useRef, useState } from "react";
import { findIndexAtOrBefore } from "./timelineUtils";

export type Speed = 1 | 2 | 4;

export interface PlaybackEngine {
  currentMs: number;
  playing: boolean;
  speed: Speed;
  smartSkip: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (ms: number) => void;
  skip: (deltaMs: number) => void;
  setSpeed: (s: Speed) => void;
  setSmartSkip: (v: boolean) => void;
}

/** Gaps wider than this are treated as "dead air" in smart-skip mode. */
const SMART_SKIP_GAP_THRESHOLD_MS = 2000;
/** Dead air is compressed down to roughly this much dwell time (scaled by speed). */
const SMART_SKIP_DWELL_MS = 300;

/**
 * Single clock driving playback over a merged, sorted event-time stream.
 *
 * Two modes:
 *  - normal: currentMs advances continuously in real time * speed, like a
 *    regular video scrubber (includes idle waiting time).
 *  - smart-skip (default): currentMs snaps discretely from event to event;
 *    gaps between events > SMART_SKIP_GAP_THRESHOLD_MS are compressed to a
 *    short dwell (SMART_SKIP_DWELL_MS / speed) instead of being played out
 *    in full, so playback only lingers on what matters.
 *
 * Runs a single requestAnimationFrame loop; all mutable per-frame state lives
 * in refs so the loop itself never needs to be restarted on prop/state
 * changes other than `playing`. Consumers (e.g. the code pane) are expected
 * to memoize derived values off `currentMs` so they only re-render when the
 * value they actually depend on (e.g. current snapshot index) changes.
 */
export function usePlaybackEngine(eventTimes: number[], durationMs: number): PlaybackEngine {
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [smartSkip, setSmartSkip] = useState(true);

  const currentMsRef = useRef(0);
  const dwellAccRef = useRef(0);
  const speedRef = useRef<Speed>(1);
  const smartSkipRef = useRef(true);
  const eventTimesRef = useRef<number[]>(eventTimes);
  const durationRef = useRef(durationMs);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    smartSkipRef.current = smartSkip;
  }, [smartSkip]);
  useEffect(() => {
    eventTimesRef.current = eventTimes;
  }, [eventTimes]);
  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  const clampAndSet = useCallback((ms: number) => {
    const clamped = Math.min(Math.max(0, ms), durationRef.current);
    currentMsRef.current = clamped;
    dwellAccRef.current = 0;
    setCurrentMs(clamped);
  }, []);

  const seek = useCallback((ms: number) => clampAndSet(ms), [clampAndSet]);
  const skip = useCallback((deltaMs: number) => clampAndSet(currentMsRef.current + deltaMs), [clampAndSet]);
  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dtReal = now - last;
      last = now;
      const spd = speedRef.current;
      const duration = durationRef.current;
      let next = currentMsRef.current;

      if (smartSkipRef.current) {
        const times = eventTimesRef.current;
        const idx = findIndexAtOrBefore(times, next);
        const curT = idx < 0 ? 0 : times[idx];
        const nextIdx = idx + 1;
        if (nextIdx < times.length) {
          const gap = times[nextIdx] - curT;
          const dwell = gap > SMART_SKIP_GAP_THRESHOLD_MS ? SMART_SKIP_DWELL_MS : Math.max(gap, 1);
          dwellAccRef.current += dtReal * spd;
          if (dwellAccRef.current >= dwell) {
            dwellAccRef.current = 0;
            next = times[nextIdx];
          }
        } else {
          next = Math.min(duration, next + dtReal * spd);
        }
      } else {
        next = Math.min(duration, next + dtReal * spd);
      }

      if (next !== currentMsRef.current) {
        currentMsRef.current = next;
        setCurrentMs(next);
      }
      if (next >= duration) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return {
    currentMs,
    playing,
    speed,
    smartSkip,
    play,
    pause,
    togglePlay,
    seek,
    skip,
    setSpeed,
    setSmartSkip,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coalesceEventTimes, findIndexAtOrBefore } from "./timelineUtils";

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

/**
 * Events closer together than this are considered part of the same "burst"
 * (e.g. code_snap throttled to fire every ~1.5-2s while typing — see
 * CONTRACTS.md) and are coalesced into a single smart-skip step rather than
 * stepping through each one individually. Deliberately set above the typical
 * throttle interval (not equal to it) so ordinary edit-to-edit gaps don't
 * teeter right on the boundary — that jitter was what made the old
 * threshold-vs-gap comparison feel broken (dense typing sometimes "skipped"
 * and sometimes played out in full, essentially at random).
 */
const SMART_SKIP_GAP_THRESHOLD_MS = 2200;
/** Caps how much wall-clock time a single coalesced burst may absorb, so a
 * typing burst lasting minutes still yields a handful of steps instead of
 * collapsing the whole thing into one imperceptible jump. */
const SMART_SKIP_BURST_SPAN_MS = 6000;
/** Fixed, constant dwell per smart-skip step (scaled by speed) — every step
 * transition takes the same perceptible beat regardless of how large the
 * underlying real-time gap was. This is what makes smart-skip unmistakably
 * different from normal playback: normal playback's pacing is real time;
 * smart-skip's pacing is this constant. */
const SMART_SKIP_DWELL_MS = 600;

/**
 * Single clock driving playback over a merged, sorted event-time stream.
 *
 * Two modes:
 *  - normal: currentMs advances continuously in real time * speed, like a
 *    regular video scrubber (includes idle waiting time).
 *  - smart-skip (default): currentMs snaps discretely between coalesced
 *    "steps" (bursts of nearby events collapsed into one) at a fixed dwell
 *    (SMART_SKIP_DWELL_MS / speed) per step, so playback only lingers on
 *    what matters and dead air (however long) is always elided.
 *
 * Runs a single requestAnimationFrame loop; all mutable per-frame state lives
 * in refs so the loop itself never needs to be restarted on prop/state
 * changes other than `playing`. Both `smartSkip` and `speed` are read fresh
 * from refs every frame, so toggling either mid-playback takes effect on the
 * very next frame — no restart needed. Consumers (e.g. the code pane) are
 * expected to memoize derived values off `currentMs` so they only re-render
 * when the value they actually depend on (e.g. current snapshot index)
 * changes.
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
  const durationRef = useRef(durationMs);

  const smartSkipSteps = useMemo(
    () => coalesceEventTimes(eventTimes, SMART_SKIP_GAP_THRESHOLD_MS, SMART_SKIP_BURST_SPAN_MS),
    [eventTimes]
  );
  const smartSkipStepsRef = useRef<number[]>(smartSkipSteps);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    smartSkipRef.current = smartSkip;
    // Toggling mode mid-flight shouldn't carry over a stale partial dwell
    // from the other mode (e.g. a near-complete dwell accumulated just
    // before switching would otherwise cause an instant extra jump).
    dwellAccRef.current = 0;
  }, [smartSkip]);
  useEffect(() => {
    smartSkipStepsRef.current = smartSkipSteps;
  }, [smartSkipSteps]);
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
        const steps = smartSkipStepsRef.current;
        const idx = findIndexAtOrBefore(steps, next);
        const nextIdx = idx + 1;
        if (nextIdx < steps.length) {
          // Fixed dwell per step, independent of the real gap it represents —
          // a 300ms burst and a 140s idle stretch both take exactly this long
          // to cross, which is what makes smart-skip's pacing unmistakably
          // different from normal real-time playback.
          dwellAccRef.current += dtReal * spd;
          if (dwellAccRef.current >= SMART_SKIP_DWELL_MS) {
            dwellAccRef.current = 0;
            next = steps[nextIdx];
          }
        } else {
          next = duration;
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

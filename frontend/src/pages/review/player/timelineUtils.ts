import type { EventOut } from "../../../lib/types";

/** Largest index i such that times[i] <= t, or -1 if none. O(log n). */
export function findIndexAtOrBefore(times: number[], t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export interface IdleRegion {
  startMs: number;
  endMs: number;
}

/** Gaps between consecutive (sorted) events wider than thresholdMs — used to
 * dim "dead air" stretches on the timeline bar. */
export function computeIdleRegions(sortedEvents: EventOut[], thresholdMs: number): IdleRegion[] {
  const regions: IdleRegion[] = [];
  for (let i = 1; i < sortedEvents.length; i++) {
    const gap = sortedEvents[i].t_ms - sortedEvents[i - 1].t_ms;
    if (gap > thresholdMs) {
      regions.push({ startMs: sortedEvents[i - 1].t_ms, endMs: sortedEvents[i].t_ms });
    }
  }
  return regions;
}

/**
 * Collapses a sorted, deduped list of event times into "steps" for smart-skip
 * playback: consecutive events closer together than `gapMs` (e.g. throttled
 * code_snap edits arriving every ~2s) are merged into a single step so a long
 * typing burst becomes one jump instead of dozens of near-imperceptible
 * micro-steps. `spanMs` caps how much wall-clock time a single burst may
 * absorb, so a burst lasting minutes still yields a handful of steps rather
 * than collapsing to one. Each step is represented by the *last* raw event
 * time in its burst (the settled state after that burst of activity).
 */
export function coalesceEventTimes(times: number[], gapMs: number, spanMs: number): number[] {
  const sorted = Array.from(new Set(times)).sort((a, b) => a - b);
  const steps: number[] = [];
  let i = 0;
  const n = sorted.length;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1] - sorted[j] <= gapMs && sorted[j + 1] - sorted[i] <= spanMs) {
      j += 1;
    }
    steps.push(sorted[j]);
    i = j + 1;
  }
  return steps;
}

export const PHASE_COLORS: Record<string, string> = {
  reading: "#60a5fa", // blue-400
  thinking: "#a78bfa", // violet-400
  coding: "#34d399", // emerald-400
  debugging: "#fbbf24", // amber-400
  stuck: "#f87171", // red-400
};

export const MARKER_GLYPH: Record<string, string> = {
  aha: "⚡", // lightning bolt
  hesitation: "‖", // double vertical bar (avoids tofu for U+23F8 in some fonts)
  "wrong-turn": "↩", // arrow hook left
};

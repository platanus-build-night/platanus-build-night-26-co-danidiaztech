import { useEffect, useMemo } from "react";
import type { AnalysisResult, SessionDetail } from "../../../lib/types";
import { EmptyState } from "../../../components/ui";
import { CodePane } from "./CodePane";
import { TranscriptStrip } from "./TranscriptStrip";
import { TimelineBar, type RunTick } from "./TimelineBar";
import { PlayerControls } from "./PlayerControls";
import { usePlaybackEngine } from "./usePlaybackEngine";
import { useCurrentTheme } from "./useCurrentTheme";
import { computeIdleRegions, findIndexAtOrBefore } from "./timelineUtils";

// Matches the feature-extractor's own "idle gap" definition (CONTRACTS.md:
// idle gaps >20s), so the player only dims genuine dead air, not normal
// pauses between narration lines.
const IDLE_DISPLAY_THRESHOLD_MS = 20000;

// A session with a single event (or all events packed into a couple of
// seconds) has nothing to actually play back — one static frame. Rather than
// render a scrubber/timeline that implies there's a video to watch, show an
// honest "not enough activity" state.
const MIN_REPLAYABLE_SPAN_MS = 2000;

interface TimeframePlayerProps {
  session: SessionDetail;
  analysis: AnalysisResult | null;
}

/**
 * The core review deliverable: a single playback clock driving a read-only
 * code reconstruction, a transcript strip, and a phase/marker timeline —
 * "a video optimized to only what matters" via the smart-skip engine.
 */
export function TimeframePlayer({ session, analysis }: TimeframePlayerProps) {
  const theme = useCurrentTheme();

  const sortedEvents = useMemo(
    () => [...session.events].sort((a, b) => a.t_ms - b.t_ms),
    [session.events]
  );
  const codeSnaps = useMemo(() => sortedEvents.filter((e) => e.kind === "code_snap"), [sortedEvents]);
  const transcripts = useMemo(() => sortedEvents.filter((e) => e.kind === "transcript"), [sortedEvents]);
  const runTicks = useMemo<RunTick[]>(
    () =>
      sortedEvents
        .filter((e) => e.kind === "run" || e.kind === "submit")
        .map((e) => ({
          id: e.id,
          atMs: e.t_ms,
          kind: e.kind as "run" | "submit",
          verdict: String(e.payload.verdict ?? "?"),
        })),
    [sortedEvents]
  );

  const durationMs = useMemo(() => {
    const started = new Date(session.started_at).getTime();
    const ended = session.ended_at ? new Date(session.ended_at).getTime() : NaN;
    const fromTimestamps = Number.isFinite(ended) ? ended - started : 0;
    const lastEvent = sortedEvents.length ? sortedEvents[sortedEvents.length - 1].t_ms : 0;
    return Math.max(fromTimestamps, lastEvent, 1000);
  }, [session.started_at, session.ended_at, sortedEvents]);

  const eventTimes = useMemo(() => sortedEvents.map((e) => e.t_ms), [sortedEvents]);
  const codeTimes = useMemo(() => codeSnaps.map((e) => e.t_ms), [codeSnaps]);
  const idleRegions = useMemo(
    () => computeIdleRegions(sortedEvents, IDLE_DISPLAY_THRESHOLD_MS),
    [sortedEvents]
  );

  const engine = usePlaybackEngine(eventTimes, durationMs);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        engine.togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        engine.skip(-5000);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        engine.skip(5000);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  const currentCodeIdx = useMemo(
    () => findIndexAtOrBefore(codeTimes, engine.currentMs),
    [codeTimes, engine.currentMs]
  );
  // Memoized off the snapshot index (not currentMs directly) so CodePane only
  // re-renders when the reconstructed snapshot actually changes.
  const currentCode = useMemo(
    () => (currentCodeIdx >= 0 ? String(codeSnaps[currentCodeIdx].payload.code ?? "") : ""),
    [currentCodeIdx, codeSnaps]
  );

  if (sortedEvents.length === 0) {
    return (
      <EmptyState
        title="No events recorded"
        description="This session has no captured events to replay yet."
      />
    );
  }

  const activitySpanMs = sortedEvents[sortedEvents.length - 1].t_ms - sortedEvents[0].t_ms;
  if (sortedEvents.length < 2 || activitySpanMs < MIN_REPLAYABLE_SPAN_MS) {
    return (
      <EmptyState
        title="Not enough activity to replay"
        description={`This session only recorded ${sortedEvents.length} event${
          sortedEvents.length === 1 ? "" : "s"
        } — too little to reconstruct a playback timeline.`}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <div className="min-h-0 min-w-0 flex-1">
        {codeSnaps.length > 0 ? (
          <CodePane code={currentCode} language={session.language} theme={theme} />
        ) : (
          <EmptyState title="No code captured" description="This session has no code snapshots." />
        )}
      </div>

      <div className="min-w-0 shrink-0 border-t border-border pt-2">
        <TranscriptStrip segments={transcripts} currentMs={engine.currentMs} onSeek={engine.seek} />
      </div>

      <div className="min-w-0 shrink-0 space-y-2 border-t border-border pt-3">
        <TimelineBar
          durationMs={durationMs}
          currentMs={engine.currentMs}
          phases={analysis?.phases ?? []}
          markers={analysis?.markers ?? []}
          idleRegions={idleRegions}
          runTicks={runTicks}
          activityTicks={codeTimes}
          onSeek={engine.seek}
        />
        <PlayerControls
          playing={engine.playing}
          speed={engine.speed}
          smartSkip={engine.smartSkip}
          currentMs={engine.currentMs}
          durationMs={durationMs}
          onTogglePlay={engine.togglePlay}
          onSkip={engine.skip}
          onSetSpeed={engine.setSpeed}
          onToggleSmartSkip={() => engine.setSmartSkip(!engine.smartSkip)}
        />
      </div>
    </div>
  );
}

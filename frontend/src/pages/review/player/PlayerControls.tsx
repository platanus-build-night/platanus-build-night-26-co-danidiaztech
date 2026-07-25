import { Button } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { formatMs } from "../format";
import type { Speed } from "./usePlaybackEngine";

const SPEEDS: Speed[] = [1, 2, 4];

interface PlayerControlsProps {
  playing: boolean;
  speed: Speed;
  smartSkip: boolean;
  currentMs: number;
  durationMs: number;
  onTogglePlay: () => void;
  onSkip: (deltaMs: number) => void;
  onSetSpeed: (s: Speed) => void;
  onToggleSmartSkip: () => void;
}

export function PlayerControls({
  playing,
  speed,
  smartSkip,
  currentMs,
  durationMs,
  onTogglePlay,
  onSkip,
  onSetSpeed,
  onToggleSmartSkip,
}: PlayerControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" variant="secondary" onClick={() => onSkip(-5000)} aria-label="Back 5 seconds">
        &laquo; 5s
      </Button>
      <Button size="sm" onClick={onTogglePlay} aria-label={playing ? "Pause" : "Play"} className="w-20">
        {playing ? "Pause" : "Play"}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => onSkip(5000)} aria-label="Forward 5 seconds">
        5s &raquo;
      </Button>

      <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSetSpeed(s)}
            aria-pressed={speed === s}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              speed === s ? "bg-accent text-accent-contrast" : "text-text-muted hover:text-text"
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={smartSkip}
        onClick={onToggleSmartSkip}
        className="ml-auto flex items-center gap-2 text-xs text-text-muted"
      >
        <span>Smart-skip</span>
        <span
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            smartSkip ? "bg-accent" : "border border-border bg-surface-alt"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
              smartSkip ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </span>
      </button>

      <span className="font-mono text-xs text-text-muted">
        {formatMs(currentMs)} / {formatMs(durationMs)}
      </span>
    </div>
  );
}

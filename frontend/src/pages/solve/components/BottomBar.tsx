import { Button, Spinner } from "../../../components/ui";
import { cn } from "../../../lib/cn";

interface BottomBarProps {
  elapsed: string;
  micSupported: boolean;
  listening: boolean;
  liveTranscript: string;
  onToggleMic: () => void;
  onRun: () => void;
  onSubmit: () => void;
  onFinish: () => void;
  running: boolean;
  submitting: boolean;
  finishing: boolean;
}

export function BottomBar({
  elapsed,
  micSupported,
  listening,
  liveTranscript,
  onToggleMic,
  onRun,
  onSubmit,
  onFinish,
  running,
  submitting,
  finishing,
}: BottomBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          variant={listening ? "primary" : "secondary"}
          size="sm"
          onClick={onToggleMic}
          disabled={!micSupported}
          aria-pressed={listening}
          title={micSupported ? undefined : "Speech recognition isn't supported in this browser"}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              listening ? "animate-pulse bg-accent-contrast" : "bg-text-muted"
            )}
          />
          {listening ? "Listening" : "Mic off"}
        </Button>

        <div className="min-w-0 flex-1 text-xs">
          {!micSupported && (
            <span className="text-text-muted">Speech recognition isn't supported in this browser.</span>
          )}
          {micSupported && listening && (
            <span className="truncate text-text-muted">
              {liveTranscript || "Listening for your reasoning…"}
            </span>
          )}
          {micSupported && !listening && (
            <span className="text-text-muted">Thinking out loud improves your analysis.</span>
          )}
        </div>
      </div>

      <div className="font-mono text-sm text-text-muted" aria-label="Elapsed time">
        {elapsed}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onRun} disabled={running}>
          {running ? <Spinner size="sm" /> : null}
          Run
        </Button>
        <Button variant="primary" size="sm" onClick={onSubmit} disabled={submitting}>
          {submitting ? <Spinner size="sm" /> : null}
          Submit
        </Button>
        <Button variant="secondary" size="sm" onClick={onFinish} disabled={finishing}>
          {finishing ? <Spinner size="sm" /> : null}
          Finish
        </Button>
      </div>
    </div>
  );
}

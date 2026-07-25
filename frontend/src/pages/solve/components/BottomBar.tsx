import { Button, Spinner } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import type { MicStatus } from "../hooks/useSpeechRecognition";

interface BottomBarProps {
  elapsed: string;
  micStatus: MicStatus;
  micErrorMessage: string | null;
  micSilentWarning: boolean;
  micWordsCaptured: number;
  liveTranscript: string;
  onToggleMic: () => void;
  onRun: () => void;
  onSubmit: () => void;
  onFinish: () => void;
  running: boolean;
  submitting: boolean;
  finishing: boolean;
}

const MIC_DOT_CLASS: Record<MicStatus, string> = {
  idle: "bg-text-muted",
  listening: "animate-pulse bg-accent-contrast",
  error: "bg-white",
  unsupported: "bg-text-muted",
};

const MIC_LABEL: Record<MicStatus, string> = {
  idle: "Mic off",
  listening: "Listening",
  error: "Mic error",
  unsupported: "Mic unavailable",
};

export function BottomBar({
  elapsed,
  micStatus,
  micErrorMessage,
  micSilentWarning,
  micWordsCaptured,
  liveTranscript,
  onToggleMic,
  onRun,
  onSubmit,
  onFinish,
  running,
  submitting,
  finishing,
}: BottomBarProps) {
  const micVariant = micStatus === "listening" ? "primary" : micStatus === "error" ? "danger" : "secondary";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          variant={micVariant}
          size="sm"
          onClick={onToggleMic}
          disabled={micStatus === "unsupported"}
          aria-pressed={micStatus === "listening"}
          title={micStatus === "error" && micErrorMessage ? micErrorMessage : undefined}
        >
          <span className={cn("h-2 w-2 rounded-full", MIC_DOT_CLASS[micStatus])} />
          {MIC_LABEL[micStatus]}
        </Button>

        <div className="min-w-0 flex-1 text-xs">
          {micStatus === "unsupported" && (
            <span className="text-text-muted">
              Speech recognition isn't supported in this browser — try Chrome or Edge.
            </span>
          )}
          {micStatus === "error" && (
            <span className="text-danger" role="alert">
              {micErrorMessage}
            </span>
          )}
          {micStatus === "listening" && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-text-muted">
                {liveTranscript || "Listening for your reasoning…"}
              </span>
              <span className="flex items-center gap-2 text-[11px] text-text-muted">
                <span>words captured: {micWordsCaptured}</span>
                {micSilentWarning && (
                  <span className="text-warning">Mic is on but nothing heard yet</span>
                )}
              </span>
            </div>
          )}
          {micStatus === "idle" && (
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

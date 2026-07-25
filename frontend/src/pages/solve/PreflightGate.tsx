import { useState } from "react";
import type { ProblemMeta } from "../../lib/types";
import { Badge, Button, Card, Spinner } from "../../components/ui";
import {
  checkSpeechAvailability,
  isSpeechRecognitionSupported,
  requestMicAccess,
} from "./hooks/useSpeechRecognition";

interface PreflightGateProps {
  problemMeta: ProblemMeta;
  /** Called once the user has committed — `recordVoice` reflects their
   * choice AND (when true) that mic access was already verified. */
  onStart: (recordVoice: boolean) => void;
  /** True while POST /sessions (which hands back the real statement) is in flight. */
  starting: boolean;
  startError: string | null;
}

type MicCheckState = "idle" | "checking" | "error";

/**
 * "Ready?" screen shown before the problem statement is revealed. The
 * statement genuinely isn't in the browser yet at this point — only
 * `ProblemMeta` (title/rating/limits) was fetched, via a route that never
 * returns statement_md/samples/editorial_md/tags. The full statement only
 * arrives in the POST /sessions response, triggered by a choice made here.
 *
 * When the user opts into recording, the mic permission pre-flight
 * (getUserMedia) runs and must succeed *before* the clock starts — so a
 * WSL-no-device or permission-denied failure is caught here, not mid-solve.
 */
export function PreflightGate({ problemMeta, onStart, starting, startError }: PreflightGateProps) {
  const [micCheck, setMicCheck] = useState<MicCheckState>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const speechSupported = isSpeechRecognitionSupported();

  const handleRecord = async () => {
    setMicCheck("checking");
    setMicError(null);

    // Two independent things can break voice capture, so check both before
    // the clock starts: the browser's speech backend (Brave blocks it
    // outright) and the mic device/permission itself.
    const speech = await checkSpeechAvailability();
    if (!speech.ok) {
      setMicCheck("error");
      setMicError(speech.message);
      return;
    }
    const access = await requestMicAccess();
    if (!access.ok) {
      setMicCheck("error");
      setMicError(access.message);
      return;
    }
    setMicCheck("idle");
    onStart(true);
  };

  const handleSkip = () => {
    setMicError(null);
    onStart(false);
  };

  const busy = starting || micCheck === "checking";

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6">
      <Card className="w-full p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Ready to start?</p>
            <h1 className="mt-1 text-2xl font-semibold text-text">{problemMeta.title}</h1>
          </div>
          {problemMeta.rating != null && <Badge tone="accent">{problemMeta.rating}</Badge>}
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-text-muted">Time limit</dt>
            <dd className="font-mono text-text">{problemMeta.time_limit_ms} ms</dd>
          </div>
          <div>
            <dt className="text-text-muted">Memory limit</dt>
            <dd className="font-mono text-text">{problemMeta.memory_limit_mb} MB</dd>
          </div>
        </dl>

        <p className="mb-6 text-sm text-text-muted">
          The statement, samples, and tags stay hidden until you commit — once you choose below, the
          clock starts and the problem is revealed. Thinking out loud (recording your voice) gives the
          post-solve analysis far more to work with than code snapshots alone.
        </p>

        {!speechSupported && (
          <p className="mb-4 text-xs text-text-muted">
            Speech recognition isn't supported in this browser (try Chrome or Edge) — voice recording
            isn't available here.
          </p>
        )}

        {micCheck === "error" && micError && (
          <p className="mb-4 text-sm text-danger" role="alert">
            {micError}
          </p>
        )}

        {startError && (
          <p className="mb-4 text-sm text-danger" role="alert">
            {startError}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleRecord}
            disabled={busy || !speechSupported}
            title={speechSupported ? undefined : "Speech recognition isn't supported in this browser"}
          >
            {micCheck === "checking" ? <Spinner size="sm" /> : null}
            Record my voice
          </Button>
          <Button variant="secondary" className="flex-1" onClick={handleSkip} disabled={busy}>
            {starting && micCheck !== "checking" ? <Spinner size="sm" /> : null}
            Solve without recording
          </Button>
        </div>
      </Card>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";

export type MicStatus = "idle" | "listening" | "error" | "unsupported";

const PERMISSION_DENIED_MSG =
  "Microphone permission denied — click the 🎤 icon in your browser's address bar to allow.";
const NO_MIC_MSG =
  "No microphone found (common in WSL — use Windows Chrome and grant permission).";
const NETWORK_MSG = "Speech service unreachable.";
const NO_GET_USER_MEDIA_MSG = "This browser can't access the microphone.";
const GENERIC_MIC_MSG = "Could not access the microphone.";
const SILENCE_WARNING_MS = 10_000;

export interface SpeechCapture {
  /** false when the browser has no SpeechRecognition implementation at all. */
  supported: boolean;
  listening: boolean;
  /** Distinct visual/semantic state for the bottom bar — not just on/off. */
  status: MicStatus;
  /** Human-readable, actionable message for the current `error`/`unsupported` state. */
  errorMessage: string | null;
  /** True once listening has run ~10s with no result at all — soft nudge, not an error. */
  silentWarning: boolean;
  /** Live, not-yet-finalized transcript text (for the "listening" chip). */
  interimText: string;
  /** Most recent finalized segment, kept around for the transcript chip. */
  lastFinalText: string;
  /** Cumulative count of words captured in finalized segments this page visit —
   * positive proof capture is actually working. */
  wordsCaptured: number;
  toggle: () => void;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Maps a getUserMedia() rejection to one of our actionable messages. */
function mapGetUserMediaError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return PERMISSION_DENIED_MSG;
  if (name === "NotFoundError" || name === "OverconstrainedError") return NO_MIC_MSG;
  return GENERIC_MIC_MSG;
}

/** True if this browser has any SpeechRecognition implementation at all
 * (Chrome/Edge; not Firefox/Safari). Exported for the pre-flight gate,
 * which needs to know this before offering "Record my voice" at all. */
export function isSpeechRecognitionSupported(): boolean {
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

/**
 * Verify/trigger the mic permission prompt and detect a missing device
 * deterministically, releasing the stream immediately (SpeechRecognition
 * opens its own). Shared by the bottom-bar mic toggle and the solve
 * pre-flight gate so permission is requested with identical, actionable
 * error handling in both places.
 */
export async function requestMicAccess(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, message: NO_GET_USER_MEDIA_MSG };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err) {
    return { ok: false, message: mapGetUserMediaError(err) };
  }
}

/** Maps a SpeechRecognition `onerror` event code to one of our actionable messages.
 * Returns null for errors that are benign / self-healing and shouldn't surface. */
function mapRecognitionError(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return PERMISSION_DENIED_MSG;
    case "audio-capture":
      return NO_MIC_MSG;
    case "network":
      return NETWORK_MSG;
    case "no-speech":
    case "aborted":
      return null;
    default:
      return `Speech recognition error: ${code}`;
  }
}

/**
 * Wraps the Web Speech API (webkitSpeechRecognition), continuous +
 * interim results. Calls `onFinalSegment` with each finalized segment and
 * its ms offset from `sessionStartMs`. Restarts itself automatically since
 * Chrome stops the recognizer after a few seconds of silence even in
 * continuous mode.
 *
 * Errors are surfaced (never silent): permission/device/support failures
 * become a distinct `status: "error" | "unsupported"` with a human message,
 * and enabling the mic first runs a getUserMedia() pre-flight so permission
 * prompts and missing-device failures are detected deterministically before
 * the recognizer is ever started.
 */
export function useSpeechRecognition(
  sessionStartMs: number,
  onFinalSegment: (text: string, tMs: number) => void
): SpeechCapture {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const [supported] = useState(() => Boolean(Ctor));
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<MicStatus>(() => (Ctor ? "idle" : "unsupported"));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [silentWarning, setSilentWarning] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [lastFinalText, setLastFinalText] = useState("");
  const [wordsCaptured, setWordsCaptured] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const onFinalSegmentRef = useRef(onFinalSegment);
  onFinalSegmentRef.current = onFinalSegment;

  const silenceTimerRef = useRef<number | null>(null);
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);
  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      setSilentWarning(true);
    }, SILENCE_WARNING_MS);
  }, [clearSilenceTimer]);

  useEffect(() => {
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      setSilentWarning(false);
      armSilenceTimer();
      // A result proves the pipeline is alive even if a transient error
      // (e.g. "network") flagged us a moment ago.
      setStatus("listening");
      setErrorMessage(null);

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) {
          setLastFinalText(text);
          setWordsCaptured((w) => w + countWords(text));
          onFinalSegmentRef.current(text, Date.now() - sessionStartMs);
        } else {
          interim += text;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      const message = mapRecognitionError(event.error);
      if (message === null) return; // benign — onend will restart if needed

      const isFatal = event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture";
      if (isFatal) {
        listeningRef.current = false;
        setListening(false);
        clearSilenceTimer();
        setSilentWarning(false);
      }
      setStatus("error");
      setErrorMessage(message);
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          // Already starting — ignore.
        }
      }
    };

    recognitionRef.current = recognition;
    return () => {
      listeningRef.current = false;
      clearSilenceTimer();
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    };
    // Recognizer is created once; sessionStartMs is stable for the session's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Ctor]);

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setStatus("idle");
    setInterimText("");
    setErrorMessage(null);
    setSilentWarning(false);
    clearSilenceTimer();
    recognitionRef.current?.stop();
  }, [clearSilenceTimer]);

  const start = useCallback(async () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    setErrorMessage(null);

    // Pre-flight: verify/trigger the mic permission prompt and detect a
    // missing device deterministically before starting the recognizer.
    const access = await requestMicAccess();
    if (!access.ok) {
      setStatus("error");
      setErrorMessage(access.message);
      return;
    }

    listeningRef.current = true;
    setListening(true);
    setStatus("listening");
    setSilentWarning(false);
    armSilenceTimer();
    try {
      recognition.start();
    } catch {
      // Already started — no-op.
    }
  }, [armSilenceTimer]);

  const toggle = useCallback(() => {
    if (status === "unsupported") return;
    if (listeningRef.current) {
      stop();
    } else {
      void start();
    }
  }, [status, start, stop]);

  return {
    supported,
    listening,
    status,
    errorMessage,
    silentWarning,
    interimText,
    lastFinalText,
    wordsCaptured,
    toggle,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeechCapture {
  /** false when the browser has no SpeechRecognition implementation at all. */
  supported: boolean;
  listening: boolean;
  /** Live, not-yet-finalized transcript text (for the "listening" chip). */
  interimText: string;
  /** Most recent finalized segment, kept around for the transcript chip. */
  lastFinalText: string;
  toggle: () => void;
}

/**
 * Wraps the Web Speech API (webkitSpeechRecognition), continuous +
 * interim results. Calls `onFinalSegment` with each finalized segment and
 * its ms offset from `sessionStartMs`. Restarts itself automatically since
 * Chrome stops the recognizer after a few seconds of silence even in
 * continuous mode.
 */
export function useSpeechRecognition(
  sessionStartMs: number,
  onFinalSegment: (text: string, tMs: number) => void
): SpeechCapture {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const [supported] = useState(() => Boolean(Ctor));
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [lastFinalText, setLastFinalText] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const onFinalSegmentRef = useRef(onFinalSegment);
  onFinalSegmentRef.current = onFinalSegment;

  useEffect(() => {
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) {
          setLastFinalText(text);
          onFinalSegmentRef.current(text, Date.now() - sessionStartMs);
        } else {
          interim += text;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {
      // Transient errors (no-speech, network) shouldn't kill capture; onend
      // handles restart. Permission errors surface as `listening` staying
      // false after the next start attempt fails.
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
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    };
    // Recognizer is created once; sessionStartMs is stable for the session's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Ctor]);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listeningRef.current) {
      listeningRef.current = false;
      setListening(false);
      setInterimText("");
      recognition.stop();
    } else {
      listeningRef.current = true;
      setListening(true);
      try {
        recognition.start();
      } catch {
        // Already started — no-op.
      }
    }
  }, []);

  return { supported, listening, interimText, lastFinalText, toggle };
}

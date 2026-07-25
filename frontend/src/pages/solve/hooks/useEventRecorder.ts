import { useCallback, useEffect, useRef } from "react";
import { api } from "../../../lib/api";
import type { EventIn, EventKind } from "../../../lib/types";

/** Batch-POST cadence for buffered events (contract: every 5s + on finish/unload). */
const FLUSH_INTERVAL_MS = 5000;

function backupKey(sessionId: number): string {
  return `trainer-session-${sessionId}-events-backup`;
}

export type RecordEvent = (kind: EventKind, payload: Record<string, unknown>) => void;

export interface EventRecorder {
  /** Append an event (t_ms computed relative to session start) and mirror to localStorage. */
  record: RecordEvent;
  /** Force-send whatever's buffered right now. Safe to call repeatedly. */
  flush: () => void;
  /** Epoch ms when this session's clock started — used for elapsed-timer display. */
  sessionStartMs: number;
}

/**
 * Buffers capture events client-side, batch-POSTs them to
 * /sessions/{id}/events every 5s (and on demand via flush), and mirrors the
 * full event log to localStorage as a crash backup.
 *
 * Pass `sessionId: null` before the session POST resolves — record() and
 * flush() become no-ops until it's set, but the session clock still starts
 * ticking at mount so elapsed time and event t_ms stay consistent.
 */
export function useEventRecorder(sessionId: number | null): EventRecorder {
  const sessionStartRef = useRef<number>(Date.now());
  const bufferRef = useRef<EventIn[]>([]);
  const allEventsRef = useRef<EventIn[]>([]);
  const sessionIdRef = useRef<number | null>(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const record = useCallback<RecordEvent>((kind, payload) => {
    const event: EventIn = { t_ms: Date.now() - sessionStartRef.current, kind, payload };
    bufferRef.current.push(event);
    allEventsRef.current.push(event);
    const id = sessionIdRef.current;
    if (id != null) {
      try {
        localStorage.setItem(backupKey(id), JSON.stringify(allEventsRef.current));
      } catch {
        // localStorage full/unavailable — the crash backup is best-effort only.
      }
    }
  }, []);

  const flush = useCallback(() => {
    const id = sessionIdRef.current;
    if (id == null || bufferRef.current.length === 0) return;
    const batch = bufferRef.current;
    bufferRef.current = [];
    api.postEvents(id, batch).catch(() => {
      // Re-queue on failure so the next tick retries; backup already has them.
      bufferRef.current = [...batch, ...bufferRef.current];
    });
  }, []);

  useEffect(() => {
    if (sessionId == null) return;
    const timer = window.setInterval(flush, FLUSH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [sessionId, flush]);

  useEffect(() => {
    if (sessionId == null) return;
    const handler = () => flush();
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, [sessionId, flush]);

  return { record, flush, sessionStartMs: sessionStartRef.current };
}

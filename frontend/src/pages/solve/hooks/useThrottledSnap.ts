import { useCallback, useEffect, useRef } from "react";
import type { RecordEvent } from "./useEventRecorder";

/**
 * code_snap capture: fires >=1.5s after the last keystroke (debounce), but
 * never lets a continuous typing streak go longer than 2s without a
 * snapshot (a hard ceiling that pre-empts the debounce while it keeps
 * getting reset).
 */
export function useCodeSnapRecorder(code: string, language: string, record: RecordEvent): void {
  const codeRef = useRef(code);
  const languageRef = useRef(language);
  const lastSnappedRef = useRef(code);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    codeRef.current = code;
    languageRef.current = language;
  }, [code, language]);

  const snap = useCallback(() => {
    if (codeRef.current === lastSnappedRef.current) return;
    lastSnappedRef.current = codeRef.current;
    dirtyRef.current = false;
    record("code_snap", { code: codeRef.current, language: languageRef.current });
  }, [record]);

  useEffect(() => {
    if (code === lastSnappedRef.current) return;
    dirtyRef.current = true;
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(snap, 1500);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [code, snap]);

  useEffect(() => {
    const ceiling = window.setInterval(() => {
      if (dirtyRef.current) snap();
    }, 2000);
    return () => window.clearInterval(ceiling);
  }, [snap]);
}

/**
 * Generic "snap N ms after the value settles" recorder for note_snap /
 * draw_snap (contract: throttled 3s after change).
 */
export function useDebouncedSnap<T>(
  value: T,
  delayMs: number,
  onCommit: (value: T) => void,
  isEqual: (a: T, b: T) => boolean = Object.is
): void {
  const lastRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (isEqual(value, lastRef.current)) return;
    const timer = window.setTimeout(() => {
      lastRef.current = value;
      onCommitRef.current(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs, isEqual]);
}

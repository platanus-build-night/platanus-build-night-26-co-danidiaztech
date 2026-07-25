import { useEffect, useState } from "react";

/** Ticking `mm:ss` elapsed-time string for the bottom bar's session timer. */
export function useElapsedTime(startMs: number): string {
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - startMs);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startMs), 1000);
    return () => window.clearInterval(timer);
  }, [startMs]);

  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

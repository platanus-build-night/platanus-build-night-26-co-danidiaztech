/** Shared mm:ss formatting helpers for the review player + summary column. */

export function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatSec(sec: number): string {
  return formatMs(sec * 1000);
}

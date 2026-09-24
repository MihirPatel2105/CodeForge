/** API datetimes are UTC. Archived Mongo-backed records may omit the offset. */
export function parseApiTime(iso: string): Date {
  // MongoDB stores UTC instants but older API responses can omit the offset.
  // JavaScript otherwise treats those strings as local time.
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(iso);
  return new Date(hasOffset ? iso : `${iso}Z`);
}

/** HH:MM:SS in the viewer's timezone, matching the clock beside a live run. */
export function formatTime(iso: string): string {
  return parseApiTime(iso).toLocaleTimeString("en-GB", { hour12: false });
}

/** "5.1s" — per-agent duration, from `duration_ms`. */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** "1m 42s" under a minute becomes "42s" — the run header's elapsed chip and the
 * result summary's Elapsed metric. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/** "2,318 bytes" */
export function formatBytes(bytes: number): string {
  return `${bytes.toLocaleString()} bytes`;
}

/** "Aug 13, 10:01" in the viewer's timezone, matching the live timeline. */
export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parseApiTime(iso));
}

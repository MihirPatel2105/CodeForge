/** HH:MM:SS in the viewer's own timezone.
 *
 * Was UTC, on the reasoning that a recorded tape should read the same for everyone.
 * That is right for a fixed replay and wrong for a live run: someone watching a run
 * happen compares the timeline against the clock on their wall, and a demo audience
 * seeing 07:11 while their phone says 12:41 assumes the product is broken.
 *
 * Note this is only readable because the backend now sends an explicit offset. While
 * event times were emitted naive, this same call rendered them shifted by the viewer's
 * offset — a naive string is parsed as local, and `toISOString()` then converted it
 * back to UTC, subtracting 5h30m on an IST machine. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour12: false });
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

/** "Aug 13, 10:01" — the run history table's "when" column. */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hh}:${mm}`;
}

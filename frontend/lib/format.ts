/** UTC HH:MM:SS — matches the recorded tape regardless of the viewer's timezone
 * (design_handoff/README.md "Durations come from ... timestamps render as UTC"). */
export function formatTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 19);
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

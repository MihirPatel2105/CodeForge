import { formatTime } from "@/lib/format";
export function RefreshStatus({ at, loading }: { at: string | null; loading: boolean }) {
  return <p role="status" className="mt-4 text-xs text-fg-muted">{loading ? "Refreshing…" : at ? `Updated ${formatTime(at)} · refreshes every minute while visible` : "Waiting for data…"}</p>;
}

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ADMIN_LABEL } from "@/components/admin/admin-shell";
import { formatElapsed, formatWhen } from "@/lib/format";
import { RUN_STATUS_META, tone } from "@/lib/tone";
import type { AdminRunSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AdminRunTable({
  runs,
  emptyLabel = "No runs found for this view.",
}: {
  runs: AdminRunSummary[];
  emptyLabel?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_18px_50px_rgba(22,24,28,0.045)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="bg-surface-2">
            <tr>
              {["Project / prompt", "User", "Outcome", "Quality", "Loops", "Updated", ""].map(
                (label) => (
                  <th key={label} className={cn(ADMIN_LABEL, "border-b border-rule px-4 py-3")}>
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const meta = RUN_STATUS_META[run.status] ?? {
                label: run.status,
                tone: "neutral" as const,
              };
              return (
                <tr key={run.id} className="border-b border-rule last:border-b-0 hover:bg-surface-2/60">
                  <td className="max-w-[330px] px-4 py-4">
                    <div className="flex items-center gap-2">
                      {run.is_live ? <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="Live" /> : null}
                      <p className="truncate text-[13px] font-[650] text-fg">{run.project_name}</p>
                    </div>
                    <p className="mt-1 truncate text-[12px] text-fg-muted">{run.prompt}</p>
                  </td>
                  <td className="px-4 py-4 font-mono text-[11px] text-fg-muted">{run.user_email}</td>
                  <td className="px-4 py-4">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] font-[700] uppercase tracking-[0.08em]", tone[meta.tone].soft)}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-[11px] text-fg-muted">
                    {run.acceptance_level ?? "—"}
                    {run.test_pass_ratio != null ? ` · ${Math.round(run.test_pass_ratio * 100)}%` : ""}
                  </td>
                  <td className="px-4 py-4 font-mono text-[11px] text-fg-muted">{run.iterations}</td>
                  <td className="px-4 py-4 font-mono text-[10.5px] text-fg-faint">
                    {formatWhen(run.updated_at)}
                    {run.end_to_end_ms != null ? <span className="mt-1 block">{formatElapsed(run.end_to_end_ms)}</span> : null}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/admin/runs/${run.id}`}
                      aria-label={`Open run ${run.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-fg-faint transition-colors hover:border-fg hover:text-fg"
                    >
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-[13px] text-fg-faint">
                  {emptyLabel}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

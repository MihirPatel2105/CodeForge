import { AnimatedTooltip } from "@/components/ui/vengeance/animated-tooltip";

export interface RunSummaryStats {
  total: number;
  succeeded: number;
  failed: number;
  avgLoops?: number | null;
}

/**
 * The project's run summary: one short serif statement, the detail as a quiet line beneath.
 * Uses only the counts the server reports, so "other" covers anything neither passed nor failed.
 */
export function ProjectRunSummary({ stats }: { stats: RunSummaryStats }) {
  if (stats.total === 0) {
    return <div className="ax-summary cf-run-summary"><p className="ax-summary-lead">No runs yet.</p></div>;
  }
  const other = Math.max(0, stats.total - stats.succeeded - stats.failed);
  return (
    <div className="ax-summary cf-run-summary">
      <p className="ax-summary-lead">
        <strong>{stats.succeeded} of {stats.total}</strong> {stats.total === 1 ? "run" : "runs"} passed.
      </p>
      <ul className="ax-summary-detail">
        <li data-tone="danger"><i aria-hidden />{stats.failed} failed</li>
        {other > 0 && <li><i aria-hidden />{other} stopped or still running</li>}
        {stats.avgLoops != null && (
          <li data-tone="loop">
            <i aria-hidden />{stats.avgLoops.toFixed(1)} repair loops on average
            <AnimatedTooltip label="average loops" content="Average repair iterations across this project's runs. A lower value means fewer repair passes, not necessarily a better API." />
          </li>
        )}
      </ul>
    </div>
  );
}

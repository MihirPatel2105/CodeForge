"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { api } from "@/lib/api";
import type { CompatibilityReport, CompatibilitySeverity } from "@/lib/types";

const verdicts: Record<CompatibilitySeverity, { title: string; tone: string }> = {
  breaking: { title: "Breaking changes detected", tone: "text-danger" },
  compatible: { title: "No breaking changes detected", tone: "text-ok" },
  needs_review: { title: "Needs review", tone: "text-warn" },
};
const labels: Record<CompatibilitySeverity, string> = {
  breaking: "Breaking change", compatible: "Compatible change", needs_review: "Needs review",
};

export function ApiCompatibility({ id, sourceId }: { id: string; sourceId: string }) {
  // A different version gets fresh state; an in-flight result cannot attach to it.
  return <CompatibilityCheck key={`${id}:${sourceId}`} id={id} sourceId={sourceId} />;
}

function CompatibilityCheck({ id, sourceId }: { id: string; sourceId: string }) {
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function check() {
    if (busy) return;
    setBusy(true);
    setError(false);
    setReport(null);
    try {
      const result = await api.checkCompatibility(id);
      if (result.source_run_id !== sourceId) throw new Error("Version changed");
      setReport(result);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const breaking = report?.changes.filter(change => change.severity === "breaking").length ?? 0;
  const review = report?.changes.filter(change => change.severity === "needs_review").length ?? 0;

  return (
    <section aria-label="API compatibility" aria-busy={busy} className="min-w-0 space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-fg">API compatibility</h3>
          <p className="mt-1 text-sm leading-6 text-fg-muted">
            Compare endpoints and fields with <Link className="text-accent underline" href={`/runs/${sourceId}`}>the source version</Link> before updating your app.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void check()}>
          {busy ? "Checking compatibility…" : report ? "Check again" : "Check compatibility"}
        </Button>
      </div>
      {!report && !error && <p className="text-sm text-fg-muted">{busy ? "Reading both API schemas…" : "Not checked yet. This starts or reuses temporary API previews."}</p>}
      {error && <Notice variant="warning">Could not check compatibility. Retry when both API versions are available.</Notice>}
      {report && <>
        <div role="status" aria-live="polite" className="space-y-1">
          <p className={`font-semibold ${verdicts[report.status].tone}`}>{verdicts[report.status].title}</p>
          <p className="text-sm text-fg-muted">{breaking} breaking {breaking === 1 ? "change" : "changes"} · {review} {review === 1 ? "item needs" : "items need"} review · {report.checked_operations} {report.checked_operations === 1 ? "endpoint" : "endpoints"} compared</p>
        </div>
        {report.changes.length > 0 && <ul className="max-h-80 space-y-3 overflow-y-auto" aria-label="Compatibility findings">
          {report.changes.map((change, index) => <li key={`${change.operation}:${change.location}:${change.code}:${index}`} className="min-w-0 border-l-2 border-border pl-3 text-sm">
            <p className={`font-semibold ${verdicts[change.severity].tone}`}>{labels[change.severity]}</p>
            <p className="mt-1 break-all font-mono text-fg">{change.operation}</p>
            <p className="break-all text-fg-muted">{change.location}</p>
            <p className="mt-1 text-fg">{change.message}</p>
          </li>)}
        </ul>}
        {report.status === "compatible" && <p className="text-sm text-fg-muted">No breaking changes were found in the supported contract checks.</p>}
      </>}
      <p className="text-sm leading-6 text-fg-muted">Checks API contracts only. Runtime behavior and data migrations need separate testing. Unsupported schemas need manual review.</p>
    </section>
  );
}

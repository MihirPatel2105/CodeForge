"use client";

import { useCallback } from "react";
import { History } from "lucide-react";
import type { CodeVersion } from "@/components/dashboard/code-panel";
import { ReplayRunView, type ReplayCopy } from "@/components/demo/replay-run-view";
import { previousVersion, versionWithChanges } from "@/lib/file-versions";
import { formatUtcDate } from "@/lib/format";
import type { RunRecording } from "@/lib/recordings";

const RECORDED_COPY: ReplayCopy = {
  back: { href: "/replay", label: "Recorded runs" },
  kindLabel: "Recorded run",
  playingLabel: "playing the recording",
  finishedLabel: "recording finished",
  approvalNote: "In the original run, a person approved this checkpoint before the agents continued.",
  pipelineEyebrow: "Recorded orchestration",
  resultLabel: "Recorded run result",
  footer:
    "This is a real CodeForge run — real models, a real sandbox and real tests — played back from its saved event log. Playback calls no model and needs no backend.",
};

/** Where the recording came from, stated plainly so nobody mistakes it for a live run. */
function Provenance({ recording }: { recording: RunRecording }) {
  return (
    <section
      aria-label="About this recording"
      className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-surface px-5 py-4"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-bd bg-accent-soft text-accent">
        <History className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-[13px] font-[700] text-accent">Recorded run</h2>
        <p className="mt-1 text-[13.5px] leading-5 text-fg-muted">
          A real past run, recorded {formatUtcDate(recording.recordedAt)} (UTC). Nothing here is
          happening live. Reference{" "}
          <span className="break-all font-mono text-[12.5px] text-fg">{recording.sourceRunId}</span>.
        </p>
        <q className="mt-2 block break-words text-[13.5px] leading-5 text-fg">{recording.prompt}</q>
      </div>
    </section>
  );
}

export function RecordedRunPage({ recording }: { recording: RunRecording }) {
  const getPreviousVersion = useCallback(
    (path: string, iteration: number): CodeVersion | null =>
      previousVersion(recording.history, path, iteration),
    [recording.history],
  );

  const getVersion = useCallback(
    (path: string, iteration: number): CodeVersion | null => {
      const content = recording.files[path];
      return content == null ? null : versionWithChanges(content, getPreviousVersion(path, iteration));
    },
    [recording.files, getPreviousVersion],
  );

  return (
    <ReplayRunView
      replayKey={recording.slug}
      title={recording.title}
      events={recording.events}
      getVersion={getVersion}
      getPreviousVersion={getPreviousVersion}
      copy={RECORDED_COPY}
      provenance={<Provenance recording={recording} />}
    />
  );
}

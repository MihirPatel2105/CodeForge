"use client";

import { useCallback, useMemo } from "react";
import type { CodeVersion } from "@/components/dashboard/code-panel";
import { ReplayRunView, type ReplayCopy } from "@/components/demo/replay-run-view";
import type { DemoRun } from "@/lib/demo-runs";

const SAMPLE_COPY: ReplayCopy = {
  back: { href: "/", label: "Home" },
  kindLabel: "Sample replay",
  playingLabel: "agents are working",
  finishedLabel: "replay complete",
  approvalNote: "This sample replay pauses for approval before continuing. It resumes automatically.",
  pipelineEyebrow: "Sample orchestration",
  resultLabel: "Demo run result",
  footer:
    "This is a deterministic replay of the CodeForge interface. The real product uses the same workflow with live models and a locked-down sandbox.",
};

export function DemoRunPage({ demo }: { demo: DemoRun }) {
  const finalFiles = useMemo(
    () => ({ ...demo.finalFiles, [demo.testFile.path]: demo.testFile.content }),
    [demo.finalFiles, demo.testFile],
  );

  const getVersion = useCallback(
    (path: string): CodeVersion | null => {
      const content = finalFiles[path];
      return content == null ? null : { content };
    },
    [finalFiles],
  );

  const getPreviousVersion = useCallback(
    (path: string, iteration: number): CodeVersion | null => {
      if (iteration === 0) return null;
      const content = demo.initialFiles[path];
      return content == null ? null : { content };
    },
    [demo.initialFiles],
  );

  return (
    <ReplayRunView
      replayKey={demo.slug}
      title={demo.title}
      events={demo.events}
      getVersion={getVersion}
      getPreviousVersion={getPreviousVersion}
      copy={SAMPLE_COPY}
    />
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { formatUtcDate } from "@/lib/format";
import { listRecordings, type RunRecording } from "@/lib/recordings";

export const metadata: Metadata = {
  title: "Recorded runs",
  description: "Real CodeForge runs played back from their saved event logs.",
};

function summary(recording: RunRecording): string {
  const result = recording.events.find((event) => event.event === "tests.result");
  const loops = recording.events.filter((event) => event.event === "loop.iteration").length;
  const tests = result?.event === "tests.result" ? `${result.total - result.failed}/${result.total} tests passed` : "tests recorded";
  return `${tests} · ${loops === 0 ? "no repair loop" : `${loops} repair ${loops === 1 ? "loop" : "loops"}`}`;
}

export default function RecordedRunsIndex() {
  const recordings = listRecordings();
  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[880px] px-4 pb-20 pt-10 sm:px-6">
        <p className="inline-flex items-center gap-2 text-[12px] font-[650] text-accent">
          <History className="h-4 w-4" aria-hidden />
          Recorded runs
        </p>
        <h1 className="font-display mt-2 text-[30px] font-[700] tracking-[-0.04em] text-fg">
          Real runs, played back offline
        </h1>
        <p className="mt-3 max-w-[60ch] text-[14.5px] leading-[1.6] text-fg-muted">
          Each of these was a real CodeForge run with real models and a real sandbox. The
          playback uses the saved event log only, so it works when the models, the backend or the
          network are unavailable.
        </p>

        <ul className="mt-8 grid gap-3">
          {recordings.map((recording) => (
            <li key={recording.slug}>
              <Link
                href={`/replay/${recording.slug}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:border-accent-bd focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="min-w-0">
                  <span className="block text-[16px] font-[650] text-fg">{recording.title}</span>
                  <span className="mt-1 block text-[13px] text-fg-muted">
                    {summary(recording)} · captured {formatUtcDate(recording.recordedAt)}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-fg-muted transition-colors group-hover:text-accent" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

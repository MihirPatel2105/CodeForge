"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { RunFlowLink } from "@/components/dashboard/run-flow-link";
import { useSession } from "@/lib/use-current-user";
import { ApiError, downloadLatestFileTree } from "@/lib/api";

export default function UseApiPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !user) router.replace("/login");
  }, [router, sessionLoading, user]);

  async function download() {
    setDownloadBusy(true);
    setDownloadError(null);
    try {
      await downloadLatestFileTree(id);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Couldn't download the project.");
    } finally {
      setDownloadBusy(false);
    }
  }

  if (!sessionLoading && !user) return null;

  return (
    <div className="cf-run-page min-h-screen bg-bg">
      <AppHeader />
      <main data-run-flow-page className="mx-auto w-full max-w-[1200px] px-4 pb-14 pt-6 sm:px-6 lg:px-10">
        <RunFlowLink href={`/runs/${id}`} className="inline-flex items-center gap-2 text-[12px] font-[650] text-fg-muted transition-colors hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Back to run
        </RunFlowLink>

        <header className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[30px] font-[650] tracking-[-0.05em] text-fg md:text-[36px]">Use your API</h1>
            <p className="mt-1 max-w-[70ch] text-[14px] leading-6 text-fg-muted">Test an endpoint, connect another app, or download the runnable source.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-ok-bd bg-ok-soft px-3 py-1.5 text-[12px] font-[650] text-ok"><span className="size-1.5 rounded-full bg-ok" />Run complete</span>
        </header>

        <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Ways to use your API">
          <RunFlowLink href={`/runs/${id}/try`} className="group rounded-xl border border-accent-bd bg-accent-soft p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transform-none">
            <span className="text-[12px] font-[700] text-accent">Test here</span>
            <h2 className="mt-3 font-display text-[19px] font-[650] text-fg">Try your API</h2>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">Send requests and inspect responses. No setup or key needed.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-[700] text-accent">Open tester <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden /></span>
          </RunFlowLink>
          <RunFlowLink href={`/runs/${id}/publish`} className="group rounded-xl border border-border bg-surface p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent-bd hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transform-none">
            <span className="text-[12px] font-[700] text-fg-muted">Connect an app</span>
            <h2 className="mt-3 font-display text-[19px] font-[650] text-fg">Publish API</h2>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">Get a URL and private key for your backend to call.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-[700] text-accent">Open publish guide <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden /></span>
          </RunFlowLink>
          <div className="rounded-xl border border-border bg-surface p-5">
            <span className="text-[12px] font-[700] text-fg-muted">Run it yourself</span>
            <h2 className="mt-3 font-display text-[19px] font-[650] text-fg">Download source</h2>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">Get a runnable ZIP with a README, Docker setup, and tests.</p>
            <p className="mt-3 text-[11px] leading-5 text-fg-muted">After unzipping, follow the README to run Docker Compose and open the API docs.</p>
            <button type="button" onClick={() => void download()} disabled={downloadBusy} className="mt-4 inline-flex items-center gap-1 rounded-lg text-[12px] font-[700] text-accent transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50">
              {downloadBusy ? "Downloading…" : "Download project"} <Download className="size-3.5" aria-hidden />
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-surface p-5 md:p-6" aria-labelledby="where-to-run-heading">
          <h2 id="where-to-run-heading" className="font-display text-[17px] font-[650] text-fg">Where does each option run?</h2>
          <div className="mt-3 grid gap-3 text-[12px] leading-5 text-fg-muted md:grid-cols-3">
            <p><strong className="text-fg">Try here:</strong> Works in your browser. Nothing to install.</p>
            <p><strong className="text-fg">Publish:</strong> CodeForge runs the API. Your backend sends requests with the key.</p>
            <p><strong className="text-fg">Download:</strong> You run the API with Docker using an available local port.</p>
          </div>
        </section>

        {downloadError && <p role="alert" className="mt-5 rounded-lg border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{downloadError}</p>}
      </main>
    </div>
  );
}

"use client";

import { toast } from "sonner";

import "@/components/dashboard/run-dashboard.css";
import { ActionIcon } from "@/components/ui/action-icon";
import { Notice } from "@/components/ui/notice";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, TerminalSquare, Radio, Package } from "lucide-react";
import { motionSpring } from "@/lib/motion-tokens";
import { AppHeader } from "@/components/dashboard/app-header";
import { RunFlowLink } from "@/components/dashboard/run-flow-link";
import { useSession } from "@/lib/use-current-user";
import { ApiError, downloadLatestFileTree } from "@/lib/api";

const MotionLink = motion.create(Link);
const cardVariants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -3, scale: 1 },
  press: { y: -1, scale: 0.995 },
};
const arrowVariants = { rest: { x: 0 }, hover: { x: 4 }, press: { x: 2 } };

export default function UseApiPage() {
  const reducedMotion = useMotionPreference();
  const cardMotion = {
    initial: "rest",
    animate: "rest",
    whileHover: reducedMotion ? "rest" : "hover",
    whileFocus: reducedMotion ? "rest" : "hover",
    whileTap: reducedMotion ? "rest" : "press",
    variants: cardVariants,
    transition: reducedMotion ? { duration: 0 } : motionSpring,
  };
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [downloadState, setDownloadState] = useState<"idle" | "pending" | "started">("idle");
  const downloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [includeAdminUi, setIncludeAdminUi] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !user) router.replace("/login");
  }, [router, sessionLoading, user]);

  useEffect(() => () => {
    if (downloadTimer.current) clearTimeout(downloadTimer.current);
  }, []);

  async function download() {
    if (downloadTimer.current) clearTimeout(downloadTimer.current);
    setDownloadState("pending");
    setDownloadError(null);
    try {
      await downloadLatestFileTree(id, includeAdminUi);
      setDownloadState("started");
      toast.success("Download started.");
      downloadTimer.current = setTimeout(() => setDownloadState("idle"), 2400);
    } catch (err) {
      setDownloadState("idle");
      setDownloadError(err instanceof ApiError ? err.message : "Couldn't download the project.");
      toast.error("Couldn't download the project. Please try again.");
    }
  }

  if (!sessionLoading && !user) return null;

  return (
    <div className="cf-run-page cf-use-page min-h-screen bg-bg">
      <AppHeader />
      <main data-run-flow-page className="mx-auto w-full max-w-[1200px] px-4 pb-14 pt-6 sm:px-6 lg:px-10">
        <RunFlowLink href={`/runs/${id}`} className="inline-flex items-center gap-2 text-[12px] font-[650] text-fg-muted transition-colors hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Back to run
        </RunFlowLink>

        <header className="cf-api-intro mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[30px] font-[650] tracking-[-0.05em] text-fg md:text-[36px]">Use your API</h1>
            <p className="mt-1 max-w-[70ch] text-[14px] leading-6 text-fg-muted">Test an endpoint, connect another app, or download the runnable source.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-ok-bd bg-ok-soft px-3 py-1.5 text-[12px] font-[650] text-ok"><span className="size-1.5 rounded-full bg-ok" />Run complete</span>
        </header>

        <section className="cf-use-options mt-6 grid gap-3 md:grid-cols-3" aria-label="Ways to use your API">
          <MotionLink {...cardMotion} href={`/runs/${id}/try`} className="cf-use-option-card group rounded-3xl border border-accent-bd bg-accent-soft p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="cf-use-card-top"><TerminalSquare aria-hidden /><span>01 / Test here</span></span>
            <h2 className="mt-3 font-display text-[19px] font-[650] text-fg">Try your API</h2>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">Send requests and inspect responses. No setup or key needed.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-[700] text-accent">Open tester <motion.span variants={arrowVariants} className="inline-flex" aria-hidden><ArrowRight className="size-3.5" /></motion.span></span>
          </MotionLink>
          <MotionLink {...cardMotion} href={`/runs/${id}/publish`} className="cf-use-option-card group rounded-3xl border border-border bg-surface p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="cf-use-card-top"><Radio aria-hidden /><span>02 / Connect an app</span></span>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[19px] font-[650] text-fg">Publish API</h2>
              <span className="rounded-full border border-accent-bd bg-accent-soft px-2 py-0.5 text-[10px] font-[700] uppercase tracking-wide text-accent">Beta</span>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">Get a URL and private key for your backend to call.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-[700] text-accent">Open publish guide <motion.span variants={arrowVariants} className="inline-flex" aria-hidden><ArrowRight className="size-3.5" /></motion.span></span>
          </MotionLink>
          <motion.div {...cardMotion} className="cf-use-option-card rounded-3xl border border-border bg-surface p-5">
            <span className="cf-use-card-top"><Package aria-hidden /><span>03 / Run it yourself</span></span>
            <h2 className="mt-3 font-display text-[19px] font-[650] text-fg">Download source</h2>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">Get a runnable ZIP with a README, Docker setup, and tests.</p>
            <p className="mt-3 text-[11px] leading-5 text-fg-muted">After unzipping, follow the README to run Docker Compose and open the API docs.</p>
            <label className="mt-4 flex items-start gap-2 text-[12px] leading-5 text-fg">
              <input type="checkbox" checked={includeAdminUi} disabled={downloadState === "pending"} onChange={event => { setIncludeAdminUi(event.target.checked); setDownloadState("idle"); }} className="mt-1 size-4 accent-accent" />
              <span><strong>Include Admin UI</strong><span className="block text-fg-muted">React dashboard with searchable tables and add, edit, and delete forms. Run it locally using ADMIN_UI.md.</span></span>
            </label>
            <button type="button" onClick={() => void download()} disabled={downloadState === "pending"} aria-busy={downloadState === "pending"} className="group mt-4 inline-flex min-w-[136px] items-center gap-1 rounded-lg text-[12px] font-[700] text-accent transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50">
              {downloadState === "pending" ? "Downloading…" : downloadState === "started" ? "Download started" : includeAdminUi ? "Download API + Admin UI" : "Download API only"} <ActionIcon kind="download" state={downloadState === "started" ? "success" : downloadState} />
            </button>
            <span role="status" className="sr-only">{downloadState === "started" ? "Project download started." : ""}</span>
          </motion.div>
        </section>

        <section className="cf-use-runtime mt-6 rounded-3xl border border-border bg-surface p-5 md:p-6" aria-labelledby="where-to-run-heading">
          <h2 id="where-to-run-heading" className="font-display text-[17px] font-[650] text-fg">Where does each option run?</h2>
          <div className="mt-3 grid gap-3 text-[12px] leading-5 text-fg-muted md:grid-cols-3">
            <p><strong className="text-fg">Try here:</strong> Works in your browser. Nothing to install.</p>
            <p><strong className="text-fg">Publish:</strong> CodeForge runs the API. Your backend sends requests with the key.</p>
            <p><strong className="text-fg">Download:</strong> You run the API with Docker using an available local port.</p>
          </div>
        </section>

        {downloadError && <Notice className="mt-5">{downloadError}</Notice>}
      </main>
    </div>
  );
}

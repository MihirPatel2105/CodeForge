"use client";

import { Notice } from "@/components/ui/notice";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { PublishGuide } from "@/components/dashboard/publish-guide";
import { RunFlowLink } from "@/components/dashboard/run-flow-link";
import { Button } from "@/components/ui/button";
import { CopyFeedback } from "@/components/ui/copy-feedback";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import type { DeploymentHealth, DeploymentInfo, PreviewOperation } from "@/lib/types";
import { useSession } from "@/lib/use-current-user";

export default function PublishApiPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null);
  const [operations, setOperations] = useState<PreviewOperation[]>([]);
  const [operationsError, setOperationsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publicationError, setPublicationError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<DeploymentHealth | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmAction, setConfirmAction] = useState<"rotate" | "unpublish" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [published, preview] = await Promise.allSettled([
      api.getDeployment(id),
      api.getPreview(id),
    ]);
    if (published.status === "fulfilled") {
      setDeployment(published.value);
      setPublicationError(false);
    } else if (published.reason instanceof ApiError && published.reason.status === 404) {
      setPublicationError(false);
      setDeployment(null);
      setApiKey(null);
      setHealth(null);
    } else {
      setPublicationError(true);
      setError(published.reason instanceof ApiError ? published.reason.message : "Couldn't load publishing status.");
    }
    if (preview.status === "fulfilled") {
      setOperations(preview.value.operations);
      setOperationsError(false);
    } else {
      setOperationsError(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    void load();
  }, [load, router, sessionLoading, user]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const created = await api.publishRun(id);
      setDeployment(created);
      setHealth(null);
      setApiKey(created.api_key);
      setShowKey(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't publish this API.");
    } finally {
      setBusy(false);
    }
  }

  async function rotateKey() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.rotateDeploymentKey(id);
      setDeployment(updated);
      setApiKey(updated.api_key);
      setShowKey(false);
      setConfirmAction(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't rotate the API key.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    try {
      await api.unpublishRun(id);
      setDeployment(null);
      setHealth(null);
      setApiKey(null);
      setShowKey(false);
      setConfirmAction(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't unpublish this API.");
      try {
        setDeployment(await api.getDeployment(id));
      } catch {
        // Keep the failure visible; the status can be retried after connectivity returns.
      }
    } finally {
      setBusy(false);
    }
  }

  async function checkConnection() {
    setChecking(true);
    setError(null);
    setHealth(null);
    try {
      setHealth(await api.checkDeployment(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't check this API. Try again.");
    } finally {
      setChecking(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      setCopied(null);
      setError("Copy failed. Select the text and copy it manually.");
    }
  }

  return (
    <div className="cf-run-page min-h-screen bg-bg">
      <AppHeader />
      <main data-run-flow-page className="mx-auto w-full max-w-[1280px] px-4 pb-14 pt-6 sm:px-6 lg:px-10">
        <RunFlowLink href={`/runs/${id}/use`} className="group inline-flex items-center gap-2 text-[13px] font-[600] text-fg-muted transition-colors hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none" aria-hidden /> Back to API options
        </RunFlowLink>

        <header className="cf-api-intro mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[30px] font-[650] tracking-[-0.05em] text-fg md:text-[36px]">Publish your API</h1>
            <p className="mt-1 max-w-[68ch] text-[14px] leading-6 text-fg-muted">Connect another app with a hosted URL and a private key.</p>
          </div>
          {deployment && !loading && <RunFlowLink href={`/runs/${id}/try`} className="group inline-flex items-center gap-1.5 text-[13px] font-[650] text-accent hover:underline">Test inside CodeForge <ExternalLink className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden /></RunFlowLink>}
        </header>

        {error && <Notice className="mt-5">{error}</Notice>}

        {loading ? <section className="mt-6 rounded-3xl border border-border bg-surface p-6 text-[13px] text-fg-muted">Checking your API…</section> : publicationError ? (
          <section className="mt-6 rounded-3xl border border-border bg-surface p-6 text-[13px] text-fg-muted">
            <p>Publication status is unavailable. Retry before making changes.</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void load()}>Retry status</Button>
          </section>
        ) : deployment ? (
          <div className="mt-6 space-y-4 motion-safe:animate-[cfFade_300ms_ease-out]">
            <section className="min-w-0 rounded-3xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="publish-status-heading">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 id="publish-status-heading" className="font-display text-[21px] font-[650] text-fg">Connection details</h2>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-[700] ${deployment.status === "active" && health?.ready !== false ? "border-ok-bd bg-ok-soft text-ok" : "border-border bg-bg text-fg-muted"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {deployment.status === "deleting" ? "Unpublishing" : deployment.status === "starting" ? "Starting" : health?.ready === false ? "Unavailable" : health?.ready ? "Ready" : "Published"}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-fg-muted">Use the URL from your backend and keep the key private.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void checkConnection()} disabled={busy || checking || deployment.status !== "active"}>{checking ? "Checking…" : "Check connection"}</Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmAction("rotate")} disabled={busy || checking || deployment.status !== "active"}>Rotate key</Button>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmAction("unpublish")} disabled={busy || checking}>{deployment.status === "deleting" ? "Retry unpublish" : "Unpublish"}</Button>
                </div>
              </div>
              <div role="status" className="mt-4 text-[12px] leading-5 text-fg-muted">
                {checking ? "Checking the hosted API…" : deployment.status === "deleting" ? "Cleanup has not finished. Retry unpublish to finish removing the API and its hosted data." : deployment.status === "starting" ? "The API is starting. Refresh its status shortly." : health ? `${health.detail} Checked at ${new Date(health.checked_at).toLocaleTimeString()}. ${health.duration_ms} ms · ${health.requests_this_minute}/${health.request_limit} gateway requests this minute.` : "Runtime health has not been checked in this session."}
              </div>
              {deployment.status === "starting" && <Button variant="outline" size="sm" className="mt-2" onClick={() => void load()}>Refresh status</Button>}
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
                <div className="min-w-0 rounded-lg border border-border bg-bg p-4">
                  <p className="text-[12px] font-[700] text-fg">Base URL</p>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                    <code className="block min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-surface px-3 py-2 text-[12px] text-fg">{deployment.url}</code>
                    <Button variant="outline" size="sm" aria-label={copied === "URL" ? "Base URL copied" : "Copy base URL"} onClick={() => void copy(deployment.url, "URL")}><CopyFeedback copied={copied === "URL"} label="Copy URL" /></Button>
                  </div>
                </div>
                {apiKey ? (
                  <Notice variant="warning" title="Save your API key now. It is shown only once.">
                    <p className="mt-1 text-[12px] text-fg-muted">Store it on your server. Anyone with this key can use the published API.</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 overflow-x-auto text-[12px] text-fg">{showKey ? apiKey : "••••••••••••••••••••"}</code>
                      <Button variant="outline" size="sm" onClick={() => setShowKey((value) => !value)}>{showKey ? "Hide key" : "Show key"}</Button>
                      <Button variant="outline" size="sm" aria-label={copied === "key" ? "API key copied" : "Copy API key"} onClick={() => void copy(apiKey, "key")}><CopyFeedback copied={copied === "key"} label="Copy key" /></Button>
                    </div>
                  </Notice>
                ) : <div className="rounded-lg border border-border bg-bg p-4"><p className="text-[12px] font-[700] text-fg">API key</p><p className="mt-2 text-[12px] leading-5 text-fg-muted"><code>{deployment.key_prefix}…</code> · The full key was shown when published. Rotate it if you lost it.</p></div>}
              </div>
              <span role="status" className="sr-only">{copied ? `${copied === "key" ? "API key" : copied === "URL" ? "Base URL" : copied === "setup" ? "Terminal setup" : "Request example"} copied.` : ""}</span>
            </section>
            <div className="min-w-0 space-y-3">
              {operationsError && <Notice variant="warning"><div className="flex flex-wrap items-center gap-3"><span>Endpoint examples could not load.</span><Button type="button" size="sm" variant="outline" onClick={() => void load()}>Retry examples</Button></div></Notice>}
              <PublishGuide url={deployment.url} status={deployment.status} apiKey={apiKey} operations={operations} copied={copied} onCopy={(value, label) => void copy(value, label)} />
            </div>
          </div>
        ) : (
          <section className="mt-6 rounded-3xl border border-border bg-surface p-6 sm:p-8" aria-labelledby="publish-status-heading">
            <div>
              <h2 id="publish-status-heading" className="font-display text-[22px] font-[650] text-fg">Ready to connect your app?</h2>
              <p className="mt-2 max-w-[65ch] text-[13px] leading-6 text-fg-muted">Publishing creates a stable URL and a one-time API key. Your CodeForge backend and Docker host must stay online. One API can be published per account.</p>
              <Button className="mt-5" onClick={publish} disabled={busy}>{busy ? "Publishing…" : "Publish API"}</Button>
            </div>
          </section>
        )}
      </main>
      <Dialog open={confirmAction !== null} onOpenChange={(open) => { if (!open && !busy) setConfirmAction(null); }}>
        <DialogContent showCloseButton={!busy} className="rounded-3xl border border-border bg-surface p-0 shadow-[0_30px_90px_rgba(22,24,28,0.22)] sm:max-w-md">
          <div className={`border-b px-6 py-5 ${confirmAction === "unpublish" ? "border-danger-bd bg-danger-soft" : "border-border bg-bg"}`}>
            <DialogHeader>
              <DialogTitle className="font-display text-[22px] tracking-[-0.04em] text-fg">
                {confirmAction === "unpublish" ? "Unpublish this API?" : "Rotate your API key?"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <DialogDescription className="px-6 text-[14px] leading-6 text-fg-muted">
            {confirmAction === "unpublish"
              ? "Your published URL will stop working and its hosted data will be permanently deleted. This cannot be undone."
              : "The current key will stop working immediately. Update any apps using it with the new key, which will be shown only once."}
          </DialogDescription>
          {error && <Notice className="mx-6">{error}</Notice>}
          <DialogFooter className="border-t border-border bg-surface px-6 py-5">
            <Button type="button" variant="outline" onClick={() => setConfirmAction(null)} disabled={busy}>Cancel</Button>
            <Button
              type="button"
              variant={confirmAction === "unpublish" ? "destructive" : "default"}
              onClick={() => void (confirmAction === "unpublish" ? unpublish() : rotateKey())}
              disabled={busy}
            >
              {busy ? "Working…" : confirmAction === "unpublish" ? "Unpublish and delete data" : "Rotate key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { PublishGuide } from "@/components/dashboard/publish-guide";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { DeploymentInfo, PreviewOperation } from "@/lib/types";
import { useSession } from "@/lib/use-current-user";

export default function PublishApiPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null);
  const [operations, setOperations] = useState<PreviewOperation[]>([]);
  const [operationsError, setOperationsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [published, preview] = await Promise.allSettled([
      api.getDeployment(id),
      api.getPreview(id),
    ]);
    if (published.status === "fulfilled") {
      setDeployment(published.value);
    } else if (!(published.reason instanceof ApiError && published.reason.status === 404)) {
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

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const created = await api.publishRun(id);
      setDeployment(created);
      setApiKey(created.api_key);
      setShowKey(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't publish this API.");
    } finally {
      setBusy(false);
    }
  }

  async function rotateKey() {
    if (!window.confirm("Replace the API key? Apps using the old key will stop working.")) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.rotateDeploymentKey(id);
      setDeployment(updated);
      setApiKey(updated.api_key);
      setShowKey(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't rotate the API key.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!window.confirm("Unpublish this API and permanently delete its hosted data?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.unpublishRun(id);
      setDeployment(null);
      setApiKey(null);
      setShowKey(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't unpublish this API.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Copy failed. Select the text and copy it manually.");
    }
  }

  return (
    <div className="cf-run-page min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1050px] px-6 pb-20 pt-9 md:px-10 lg:px-14">
        <Link href={`/runs/${id}/try`} className="inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.13em] text-fg-faint hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to API options
        </Link>

        <header className="mt-5 rounded-xl border border-border bg-surface p-6 md:p-9">
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-accent">use it from another app</p>
          <h1 className="font-display mt-3 text-[30px] font-[650] tracking-[-0.05em] text-fg md:text-[38px]">Publish your API</h1>
          <p className="mt-3 max-w-[68ch] text-[14px] leading-6 text-fg-muted">CodeForge runs the API for you and gives you a URL plus a private key. Your app sends requests to that URL through its backend. You do not need to download or run the generated folder.</p>
        </header>

        {error && <p role="alert" className="mt-5 rounded-lg border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p>}

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 md:p-9" aria-labelledby="publish-status-heading">
          {loading ? <p className="text-[13px] text-fg-muted">Checking your API…</p> : deployment ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.13em] text-ok">published</p>
                  <h2 id="publish-status-heading" className="font-display mt-2 text-[22px] font-[650] text-fg">Your connection details</h2>
                </div>
                <Link href={`/runs/${id}/try`} className="inline-flex items-center gap-1 text-[12px] font-[700] text-accent hover:underline">Test inside CodeForge <ExternalLink className="h-3 w-3" aria-hidden /></Link>
              </div>
              <div>
                <p className="text-[12px] font-[700] text-fg">Base URL</p>
                <p className="mt-1 text-[12px] text-fg-muted">Add an endpoint path such as <code>/contacts</code> to this URL.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-bg px-3 py-2 text-[12px] text-fg">{deployment.url}</code>
                  <Button variant="outline" size="sm" aria-label="Copy base URL" onClick={() => void copy(deployment.url, "URL")}><Copy className="h-3.5 w-3.5" aria-hidden /> Copy URL</Button>
                </div>
              </div>
              {apiKey ? (
                <div className="rounded-lg border border-warn-bd bg-warn-soft p-4">
                  <p className="text-[12px] font-[700] text-fg">Save your API key now. It is shown only once.</p>
                  <p className="mt-1 text-[12px] text-fg-muted">Store it on your server. Anyone with this key can use the published API.</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 overflow-x-auto text-[12px] text-fg">{showKey ? apiKey : "••••••••••••••••••••"}</code>
                    <Button variant="outline" size="sm" onClick={() => setShowKey((value) => !value)}>{showKey ? "Hide key" : "Show key"}</Button>
                    <Button variant="outline" size="sm" aria-label="Copy API key" onClick={() => void copy(apiKey, "key")}><Copy className="h-3.5 w-3.5" aria-hidden /> Copy key</Button>
                  </div>
                </div>
              ) : <p className="text-[12px] text-fg-muted">Key: {deployment.key_prefix}… · The full key was shown when published. Rotate it if you lost it.</p>}
              {copied && <p role="status" className="text-[12px] text-ok">{copied === "key" ? "API key" : copied === "URL" ? "Base URL" : copied === "setup" ? "Terminal setup" : "Request"} copied.</p>}
              {operationsError && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warn-bd bg-warn-soft p-3 text-[12px] text-fg"><span>Endpoint examples could not load.</span><Button type="button" size="sm" variant="outline" onClick={() => void load()}>Retry examples</Button></div>}
              <PublishGuide url={deployment.url} status={deployment.status} apiKey={apiKey} operations={operations} onCopy={(value, label) => void copy(value, label)} />
              <div className="flex flex-wrap gap-2 border-t border-border pt-5">
                <Button variant="outline" size="sm" onClick={rotateKey} disabled={busy}>Rotate key</Button>
                <Button variant="destructive" size="sm" onClick={unpublish} disabled={busy}>Unpublish and delete data</Button>
              </div>
            </div>
          ) : (
            <div>
              <h2 id="publish-status-heading" className="font-display text-[22px] font-[650] text-fg">Ready to connect your app?</h2>
              <p className="mt-2 max-w-[65ch] text-[13px] leading-6 text-fg-muted">Publishing creates a stable URL and a one-time API key. Your CodeForge backend and Docker host must stay online. One API can be published per account.</p>
              <Button className="mt-5" onClick={publish} disabled={busy}>{busy ? "Publishing…" : "Publish API"}</Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

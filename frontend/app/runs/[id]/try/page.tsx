"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Download, Play, RotateCcw } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/use-current-user";
import { api, ApiError, downloadLatestFileTree } from "@/lib/api";
import type { PreviewInfo, PreviewOperation, PreviewResult } from "@/lib/types";

function displayBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export default function TryApiPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [preview, setPreview] = useState<PreviewInfo | null>(null);
  const [selected, setSelected] = useState(0);
  const [path, setPath] = useState("");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const choose = useCallback((operation: PreviewOperation, index: number) => {
    setSelected(index);
    setPath(operation.path);
    setBody(operation.has_body ? JSON.stringify(operation.example_body ?? {}, null, 2) : "");
    setResponse(null);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await api.getPreview(id);
      setPreview(info);
      if (info.operations.length > 0) choose(info.operations[0], 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the API preview.");
    } finally {
      setLoading(false);
    }
  }, [choose, id]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    void load();
  }, [id, load, router, sessionLoading, user]);

  async function download() {
    setDownloadBusy(true);
    setError(null);
    try {
      await downloadLatestFileTree(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't download the project.");
    } finally {
      setDownloadBusy(false);
    }
  }

  async function send() {
    const operation = preview?.operations[selected];
    if (!operation) return;
    setError(null);
    setResponse(null);
    let parsedBody: unknown = null;
    if (operation.has_body) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        setError("Request body must be valid JSON.");
        return;
      }
    }
    setSending(true);
    try {
      setResponse(await api.sendPreviewRequest(id, {
        method: operation.method,
        path: path.trim(),
        body: parsedBody,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the request.");
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    setSending(true);
    setError(null);
    try {
      await api.resetPreview(id);
      setResponse(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reset the preview.");
    } finally {
      setSending(false);
    }
  }

  const operation = preview?.operations[selected];

  return (
    <div className="cf-run-page min-h-screen bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1100px] px-6 pb-20 pt-9 md:px-10 lg:px-14">
        <Link href={`/runs/${id}`} className="inline-flex items-center gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.13em] text-fg-faint hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to run
        </Link>

        <section className="cf-run-hero mt-5 rounded-xl border border-border bg-surface p-6 md:p-9">
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-accent">tests passed · choose your next step</span>
          <h1 className="font-display mt-3 text-[30px] font-[650] tracking-[-0.05em] text-fg md:text-[38px]">Your API is ready</h1>
          <p className="mt-3 max-w-[70ch] text-[14px] leading-6 text-fg-muted">You can test it here, connect it to another app, or download the source and run it yourself. Pick the option that matches what you want to do.</p>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Ways to use your API">
          <a href="#test-api" className="group rounded-xl border border-accent-bd bg-accent-soft p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <span className="font-mono text-[11px] font-[700] text-accent">01 · test here</span>
            <h2 className="mt-3 font-display text-[19px] font-[650] text-fg">Try an endpoint</h2>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">See requests and responses now. No setup or key needed.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-[700] text-accent">Open tester <ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
          </a>
          <Link href={`/runs/${id}/publish`} className="group rounded-xl border border-border bg-surface p-5 hover:border-accent-bd focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <span className="font-mono text-[11px] font-[700] text-fg-faint">02 · connect an app</span>
            <h2 className="mt-3 font-display text-[19px] font-[650] text-fg">Publish API</h2>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">Get a URL and private key for your backend to call.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-[700] text-accent">Open publish guide <ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
          </Link>
          <div className="rounded-xl border border-border bg-surface p-5">
            <span className="font-mono text-[11px] font-[700] text-fg-faint">03 · run it yourself</span>
            <h2 className="mt-3 font-display text-[19px] font-[650] text-fg">Download source</h2>
            <p className="mt-2 text-[12px] leading-5 text-fg-muted">Get a runnable zip with a README, Docker setup, and tests.</p>
            <p className="mt-3 text-[11px] leading-5 text-fg-muted">After unzipping: run <code className="text-fg">docker compose up --build</code> in that folder, then open <code className="text-fg">localhost:8000/docs</code>.</p>
            <button type="button" onClick={() => void download()} disabled={downloadBusy} className="mt-4 inline-flex items-center gap-1 rounded-sm text-[12px] font-[700] text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">{downloadBusy ? "Downloading…" : "Download project"} <Download className="h-3.5 w-3.5" aria-hidden /></button>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-surface p-5 md:p-6" aria-labelledby="where-to-run-heading">
          <h2 id="where-to-run-heading" className="font-display text-[17px] font-[650] text-fg">Where does each option run?</h2>
          <div className="mt-3 grid gap-3 text-[12px] leading-5 text-fg-muted md:grid-cols-3">
            <p><strong className="text-fg">Try here:</strong> Works in this page. Nothing to install.</p>
            <p><strong className="text-fg">Publish:</strong> CodeForge runs the API. Your backend sends requests with the key.</p>
            <p><strong className="text-fg">Download:</strong> You run the API on your computer with Docker. Use port 8001 if CodeForge already uses 8000.</p>
          </div>
        </section>

        {error && <p role="alert" className="mt-5 rounded-lg border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p>}

        {loading ? (
          <p className="mt-8 font-mono text-[12px] text-fg-muted">Starting your temporary API…</p>
        ) : preview ? (
          <section id="test-api" className="mt-9 scroll-mt-8" aria-labelledby="test-api-heading">
            <div className="mb-4">
              <h2 id="test-api-heading" className="font-display text-[23px] font-[650] text-fg">Try your API</h2>
              <p className="mt-1 text-[13px] leading-5 text-fg-muted">Choose an endpoint, edit the example request, then press Send. This private preview resets after 15 minutes.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="rounded-xl border border-border bg-surface p-6" aria-labelledby="request-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="request-heading" className="font-display text-[21px] font-[650] text-fg">Request</h2>
                <Button variant="outline" size="sm" onClick={reset} disabled={sending}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset data
                </Button>
              </div>
              {preview.operations.length === 0 ? (
                <p className="mt-6 text-[13px] text-fg-muted">This API has no endpoints to try.</p>
              ) : (
                <div className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="preview-operation" className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-fg-faint">Endpoint</label>
                    <select id="preview-operation" value={selected} onChange={(event) => choose(preview.operations[Number(event.target.value)], Number(event.target.value))} className="mt-2 h-11 w-full rounded-lg border border-border-strong bg-bg px-3 font-mono text-[12px] text-fg">
                      {preview.operations.map((item, index) => <option key={`${item.method}-${item.path}`} value={index}>{item.method} {item.path}</option>)}
                    </select>
                    {operation?.summary && <p className="mt-2 text-[12px] text-fg-muted">{operation.summary}</p>}
                  </div>
                  <div>
                    <label htmlFor="preview-path" className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-fg-faint">Path</label>
                    <Input id="preview-path" value={path} onChange={(event) => setPath(event.target.value)} className="mt-2 font-mono" />
                    {path.includes("{") && <p className="mt-2 text-[12px] text-fg-muted">Replace each name in braces with an actual ID or value.</p>}
                  </div>
                  {operation?.has_body && (
                    <div>
                      <label htmlFor="preview-body" className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-fg-faint">JSON body</label>
                      <Textarea id="preview-body" value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false} className="mt-2 min-h-48 font-mono text-[12px]" />
                    </div>
                  )}
                  <Button onClick={send} disabled={sending || path.includes("{")} className="h-10 gap-2 px-5">
                    <Play className="h-3.5 w-3.5" aria-hidden /> {sending ? "Sending…" : "Send request"}
                  </Button>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-6" aria-labelledby="response-heading">
              <h2 id="response-heading" className="font-display text-[21px] font-[650] text-fg">Response</h2>
              {response ? (
                <div className="mt-6">
                  <p className={`font-mono text-[12px] font-[700] ${response.status < 400 ? "text-ok" : "text-danger"}`}>
                    HTTP {response.status} · {response.duration_ms} ms
                  </p>
                  {response.session_started && <p className="mt-2 text-[12px] text-fg-muted">A fresh temporary database was started for this request.</p>}
                  <pre className="mt-4 max-h-[32rem] overflow-auto rounded-lg bg-term-bg p-4 font-mono text-[12px] leading-5 whitespace-pre-wrap break-all text-term-fg">{displayBody(response.body) || "No response body"}</pre>
                  {response.truncated && <p className="mt-2 text-[12px] text-warn">Response shortened to 100 KB.</p>}
                </div>
              ) : <p className="mt-6 text-[13px] text-fg-muted">Send a request to see what your API returns.</p>}
            </section>
            </div>
          </section>
        ) : (
          <Button variant="outline" onClick={() => void load()} className="mt-6">Try again</Button>
        )}
      </main>
    </div>
  );
}

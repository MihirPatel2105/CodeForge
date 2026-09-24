"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/use-current-user";
import { api, ApiError } from "@/lib/api";
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
  }, [load, router, sessionLoading, user]);

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

        <section className="cf-run-hero mt-5 rounded-[6px] border border-border bg-surface p-6 md:p-9">
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-accent">temporary sandbox</span>
          <h1 className="font-display mt-3 text-[30px] font-[650] tracking-[-0.05em] text-fg md:text-[38px]">Try your API</h1>
          <p className="mt-3 max-w-[70ch] text-[14px] leading-6 text-fg-muted">
            Choose an endpoint, edit the example request, and press Send. No setup or API key is needed here.
            This preview stays private, has no public URL, and its data resets after 15 minutes.
          </p>
        </section>

        {error && <p role="alert" className="mt-5 rounded-[4px] border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p>}

        {loading ? (
          <p className="mt-8 font-mono text-[12px] text-fg-muted">Starting your temporary API…</p>
        ) : preview ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="rounded-[6px] border border-border bg-surface p-6" aria-labelledby="request-heading">
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
                    <select id="preview-operation" value={selected} onChange={(event) => choose(preview.operations[Number(event.target.value)], Number(event.target.value))} className="mt-2 h-11 w-full rounded-[3px] border border-border-strong bg-bg px-3 font-mono text-[12px] text-fg">
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

            <section className="rounded-[6px] border border-border bg-surface p-6" aria-labelledby="response-heading">
              <h2 id="response-heading" className="font-display text-[21px] font-[650] text-fg">Response</h2>
              {response ? (
                <div className="mt-6">
                  <p className={`font-mono text-[12px] font-[700] ${response.status < 400 ? "text-ok" : "text-danger"}`}>
                    HTTP {response.status} · {response.duration_ms} ms
                  </p>
                  {response.session_started && <p className="mt-2 text-[12px] text-fg-muted">A fresh temporary database was started for this request.</p>}
                  <pre className="mt-4 max-h-[32rem] overflow-auto rounded-[4px] bg-term-bg p-4 font-mono text-[12px] leading-5 whitespace-pre-wrap break-all text-term-fg">{displayBody(response.body) || "No response body"}</pre>
                  {response.truncated && <p className="mt-2 text-[12px] text-warn">Response shortened to 100 KB.</p>}
                </div>
              ) : <p className="mt-6 text-[13px] text-fg-muted">Send a request to see what your API returns.</p>}
            </section>
          </div>
        ) : (
          <Button variant="outline" onClick={() => void load()} className="mt-6">Try again</Button>
        )}
      </main>
    </div>
  );
}

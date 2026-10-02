"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Play, RotateCcw } from "lucide-react";
import { RequestFields } from "@/components/dashboard/request-fields";
import { readLocal, writeLocal } from "@/lib/workspace-storage";
import { AppHeader } from "@/components/dashboard/app-header";
import { RunFlowLink } from "@/components/dashboard/run-flow-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/use-current-user";
import { api, ApiError } from "@/lib/api";
import type { PreviewInfo, PreviewOperation, PreviewResult } from "@/lib/types";

type SavedRequest = { key: string; method: PreviewOperation["method"]; endpoint: string; path: string; body: string; response?: PreviewResult; at: string };

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
  const [pendingAction, setPendingAction] = useState<"send" | "reset" | null>(null);
  const [mode, setMode] = useState<"json" | "fields">("json");
  const [fieldsValid, setFieldsValid] = useState(true);
  const [saved, setSaved] = useState<SavedRequest[]>([]);
  const [recent, setRecent] = useState<SavedRequest[]>([]);
  const [recordId, setRecordId] = useState<{ collection: string; value: string } | null>(null);
  const [guide, setGuide] = useState(false);
  const [notice, setNotice] = useState("");
  const storageKey = user ? `codeforge:requests:${user.id}:${id}` : null;
  useEffect(() => { if (storageKey) { const stored = readLocal<SavedRequest[]>(storageKey, []); setSaved(Array.isArray(stored) ? stored : []); } }, [storageKey]);
  const [error, setError] = useState<string | null>(null);
  const sending = pendingAction !== null;

  const choose = useCallback((operation: PreviewOperation, index: number) => {
    setSelected(index);
    setMode("json"); setFieldsValid(true);
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

  async function send() {
    const operation = preview?.operations[selected];
    if (!operation) return;
    setError(null);
    let parsedBody: unknown = null;
    if (operation.has_body) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        setError("Request body must be valid JSON.");
        return;
      }
    }
    setPendingAction("send");
    try {
      const result = await api.sendPreviewRequest(id, {
        method: operation.method,
        path: path.trim(),
        body: parsedBody,
      });
      setResponse(result);
      setRecent(current => [{ key: crypto.randomUUID(), method: operation.method, endpoint: operation.path, path, body, response: { ...result, body: result.body.slice(0, 20000) }, at: new Date().toISOString() }, ...current].slice(0, 10));
      if (result.session_started) setRecordId(null);
      if (result.status < 400 && operation.method === "POST") {
        try { const data = JSON.parse(result.body); if (typeof data.id === "string" || typeof data.id === "number") setRecordId({ collection: operation.path.replace(/\/$/, ""), value: String(data.id) }); } catch { /* Some APIs return no JSON body. */ }
      }
    } catch (err) {
      setResponse(null);
      setError(err instanceof ApiError ? err.message : "Couldn't send the request.");
    } finally {
      setPendingAction(null);
    }
  }

  async function reset() {
    setPendingAction("reset");
    setError(null);
    try {
      await api.resetPreview(id);
      setRecordId(null); setRecent([]);
      setResponse(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reset the preview.");
    } finally {
      setPendingAction(null);
    }
  }

  const operation = preview?.operations[selected];

  function saveRequest() {
    if (!operation || !storageKey) return;
    const next = [{ key: crypto.randomUUID(), method: operation.method, endpoint: operation.path, path, body, at: new Date().toISOString() }, ...saved].slice(0, 20);
    setSaved(next); setNotice(writeLocal(storageKey, next) ? "Request saved on this device." : "Could not save this request on this device.");
  }
  function restore(item: SavedRequest) {
    const index = preview?.operations.findIndex(operation => operation.method === item.method && operation.path === item.endpoint) ?? -1;
    if (index < 0) { setError("That endpoint is no longer available."); return; }
    choose(preview!.operations[index], index); setPath(item.path); setBody(item.body); setResponse(item.response ?? null);
  }

  return (
    <div className="cf-run-page min-h-screen bg-bg">
      <AppHeader />
      <main data-run-flow-page className="mx-auto w-full max-w-[1280px] px-4 pb-14 pt-6 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RunFlowLink href={`/runs/${id}/use`} className="group inline-flex items-center gap-2 text-[13px] font-[650] text-fg-muted transition-colors hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> Ways to use your API
          </RunFlowLink>
          <RunFlowLink href={`/runs/${id}`} className="text-[13px] font-[650] text-fg-muted transition-colors hover:text-fg">Back to run</RunFlowLink>
        </div>

        <header className="cf-api-intro mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="try-api-heading" className="font-display text-[30px] font-[650] tracking-[-0.05em] text-fg md:text-[36px]">Try your API</h1>
            <p className="mt-1 max-w-[70ch] text-[14px] leading-6 text-fg-muted">Choose an endpoint, edit the request, and inspect the response.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-bd bg-accent-soft px-3 py-1.5 text-[12px] font-[650] text-accent"><span className="size-1.5 rounded-full bg-accent" />Private preview · resets after 15 minutes</span>
        </header>

        <div className="mt-5"><Button variant="outline" onClick={() => setGuide(!guide)}>{guide ? "Hide CRUD walkthrough" : "Show CRUD walkthrough"}</Button>{guide && <ol className="mt-3 grid gap-2 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-4">{["1. POST: create a record", "2. GET: inspect the new record", "3. PUT/PATCH: change a field", "4. DELETE: remove the test record"].map(step => <li key={step}>{step}</li>)}<li className="text-fg-muted sm:col-span-4">Select each endpoint below and send it yourself. After POST, use the returned ID for the other requests. Preview data is temporary.</li></ol>}</div>
        {notice && <p role="status" className="mt-3 text-sm text-fg-muted">{notice}</p>}
        {error && <p role="alert" className="mt-5 rounded-lg border border-danger-bd bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p>}

        {loading ? (
          <p className="mt-8 font-mono text-[12px] text-fg-muted">Starting your temporary API…</p>
        ) : preview ? (
          <section className="mt-6" aria-labelledby="try-api-heading">
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="request-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="request-heading" className="font-display text-[21px] font-[650] text-fg">Request</h2>
                <Button variant="outline" size="sm" onClick={reset} disabled={sending} className="group">
                  <RotateCcw className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-rotate-45 motion-reduce:transition-none" aria-hidden /> Reset data
                </Button>
              </div>
              {preview.operations.length === 0 ? (
                <p className="mt-6 text-[13px] text-fg-muted">This API has no endpoints to try.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="preview-operation" className="text-[12px] font-[700] text-fg">Endpoint</label>
                    <div className="relative mt-2">
                      <select id="preview-operation" value={selected} onChange={(event) => choose(preview.operations[Number(event.target.value)], Number(event.target.value))} className="h-11 w-full appearance-none rounded-lg border border-border-strong bg-bg px-3 pr-11 font-mono text-[12px] text-fg transition-[border-color,box-shadow] duration-200 hover:border-accent-bd focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        {preview.operations.map((item, index) => <option key={`${item.method}-${item.path}`} value={index}>{item.method} {item.path}</option>)}
                      </select>
                      <ChevronDown data-testid="endpoint-chevron" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
                    </div>
                    {operation?.summary && <p className="mt-2 text-[12px] text-fg-muted">{operation.summary}</p>}
                  </div>
                  <div>
                    <label htmlFor="preview-path" className="text-[12px] font-[700] text-fg">Path</label>
                    <Input id="preview-path" value={path} onChange={(event) => setPath(event.target.value)} className="mt-2 font-mono" />
                    {recordId && operation?.path.startsWith(`${recordId.collection}/`) && /\{[^}]+\}/.test(operation.path) && <Button variant="outline" size="sm" className="mt-2" onClick={() => setPath(operation.path.replace(/\{[^}]+\}/, encodeURIComponent(recordId.value)))}>Use this ID: {recordId.value}</Button>}
                    {path.includes("{") && <p className="mt-2 text-[12px] text-fg-muted">Replace each name in braces with an actual ID or value.</p>}
                  </div>
                  {operation?.has_body && (
                    <div>
                      {operation.body_schema?.properties && <div className="mb-3 flex gap-2"><Button variant={mode === "json" ? "default" : "outline"} size="sm" onClick={() => { setMode("json"); setFieldsValid(true); }}>JSON</Button><Button variant={mode === "fields" ? "default" : "outline"} size="sm" onClick={() => { try { const parsed = JSON.parse(body); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(); setMode("fields"); setError(null); } catch { setError("Use a JSON object before switching to fields."); } }}>Fields</Button></div>}
                      {mode === "fields" && operation.body_schema ? <RequestFields key={`${selected}:fields`} schema={operation.body_schema} body={body} onChange={setBody} onValidity={setFieldsValid} /> : <><label htmlFor="preview-body" className="text-[12px] font-[700] text-fg">JSON body</label>
                      <Textarea id="preview-body" value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false} className="mt-2 min-h-48 font-mono text-[12px]" /></>}
                    </div>
                  )}
                  <Button variant="outline" onClick={saveRequest} disabled={sending || !fieldsValid}>Save request</Button>
                  <Button onClick={send} disabled={sending || path.includes("{") || !fieldsValid} className="h-10 gap-2 px-5">
                    <Play className="h-3.5 w-3.5" aria-hidden /> {sending ? "Sending…" : "Send request"}
                  </Button>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="response-heading">
              <h2 id="response-heading" className="font-display text-[21px] font-[650] text-fg">Response</h2>
              {pendingAction && <p role="status" className="mt-4 flex items-center gap-2 text-[12px] font-[650] text-accent"><span className="size-1.5 rounded-full bg-accent motion-safe:animate-[cfDot_1.1s_ease-in-out_infinite]" aria-hidden />{pendingAction === "send" ? "Sending request…" : "Resetting preview…"}</p>}
              {response ? (
                <div aria-busy={sending} className={`mt-6 motion-safe:animate-[cfFade_240ms_ease-out] transition-opacity duration-200 motion-reduce:transition-none ${sending ? "opacity-45" : "opacity-100"}`}>
                  <p className={`font-mono text-[12px] font-[700] ${response.status < 400 ? "text-ok" : "text-danger"}`}>
                    HTTP {response.status} · {response.duration_ms} ms
                  </p>
                  {response.session_started && <p className="mt-2 text-[12px] text-fg-muted">A fresh temporary database was started for this request.</p>}
                  <pre className="mt-4 max-h-[32rem] overflow-auto rounded-lg bg-term-bg p-4 font-mono text-[12px] leading-5 whitespace-pre-wrap break-all text-term-fg">{displayBody(response.body) || "No response body"}</pre>
                  {response.truncated && <p className="mt-2 text-[12px] text-warn">Response shortened to 100 KB.</p>}
                </div>
              ) : <div className="mt-5 flex min-h-44 items-center justify-center rounded-lg border border-dashed border-border bg-bg px-5 text-center text-[13px] text-fg-muted">{pendingAction === "send" ? "Waiting for the API…" : pendingAction === "reset" ? "Clearing temporary data…" : "Send a request to see what your API returns."}</div>}
            </section>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">{[{ title: "Saved requests", items: saved }, { title: "Recent responses", items: recent }].map(group => <section key={group.title} className="rounded-2xl border border-border bg-surface p-5"><h2 className="font-semibold">{group.title}</h2><p className="mt-1 text-xs text-fg-muted">{group.title === "Saved requests" ? "Stored on this device. Loading a request does not send it." : "Last 10 responses in this visit; previews limited to 20 KB."}</p>{group.items.length ? group.items.map(item => <div key={item.key} className="mt-3 flex items-center gap-2"><Button variant="outline" className="h-auto min-h-10 min-w-0 flex-1 justify-start whitespace-normal break-all text-left text-xs" disabled={sending} onClick={() => restore(item)}>{item.method} {item.path}{item.response ? ` · HTTP ${item.response.status}` : ""}</Button>{group.title === "Saved requests" && <Button variant="ghost" size="sm" onClick={() => { const next = saved.filter(value => value.key !== item.key); setSaved(next); if (storageKey) writeLocal(storageKey, next); }}>Remove</Button>}</div>) : <p className="mt-3 text-sm text-fg-muted">Nothing saved yet.</p>}</section>)}</div>
          </section>
        ) : (
          <Button variant="outline" onClick={() => void load()} className="mt-6">Try again</Button>
        )}
      </main>
    </div>
  );
}

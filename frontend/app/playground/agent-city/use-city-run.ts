"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_BASE_URL, ApiError, getToken } from "@/lib/api";
import { applyEvent, initialSnapshot, type RunSnapshot } from "@/lib/run-reducer";
import type { CodeForgeEvent } from "@/lib/types";
import type { ConnectionLostInfo } from "@/lib/use-run-stream";

interface CityRunData {
  key: string;
  snapshot: RunSnapshot;
  events: CodeForgeEvent[];
  loading: boolean;
  connectionLost: ConnectionLostInfo | null;
  error: string | null;
  files: Record<string, string>;
  filesError: string | null;
  state: Record<string, unknown>;
}

const activeStatuses = new Set(["queued", "running", "awaiting_approval"]);
const eventNames = new Set(["run.started", "run.retried", "agent.started", "agent.message", "agent.completed", "agent.failed", "approval.required", "approval.resolved", "loop.iteration", "file.written", "sandbox.started", "sandbox.output", "tests.result", "run.completed", "run.failed"]);

function emptyData(key: string, loading: boolean): CityRunData {
  return { key, snapshot: initialSnapshot(), events: [], loading, connectionLost: null, error: null, files: {}, filesError: null, state: {} };
}

function accessError(status: number): string {
  return status === 401 ? "Sign in to watch this run in Agent City." : "This run is unavailable or you don’t have access to it.";
}

/** A read-only city observer. The saved SSE sequence also supplies exact replay. */
export function useCityRun(runId: string | null) {
  const [generation, setGeneration] = useState(0);
  const key = `${runId ?? "demo"}:${generation}`;
  const [data, setData] = useState<CityRunData>(() => emptyData(key, Boolean(runId)));
  const refreshRef = useRef<(() => void) | null>(null);
  const retry = useCallback(() => setGeneration(value => value + 1), []);
  const refreshFiles = useCallback(() => refreshRef.current?.(), []);

  useEffect(() => {
    const initial = emptyData(key, Boolean(runId));
    setData(initial);
    if (!runId) return;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(runId)) {
      setData({ ...initial, loading: false, error: "This run link is invalid. Open a run from your projects." });
      return;
    }
    let hasSession = false;
    try { hasSession = Boolean(getToken()); } catch { hasSession = document.cookie.split("; ").includes("codeforge_session_present=1"); }
    if (!hasSession) {
      setData({ ...initial, loading: false, error: accessError(401) });
      return;
    }

    const id = runId;
    let disposed = false;
    let stopped = false;
    let ended = false;
    let historical = false;
    let lastEventId = 0;
    let attempt = 0;
    let emptyConnections = 0;
    let snapshot = initialSnapshot();
    let events: CodeForgeEvent[] = [];
    let state: Record<string, unknown> = {};
    let evidencePending = false;
    let evidenceDirty = false;
    let terminalRefreshes = 0;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let staleTimer: ReturnType<typeof setTimeout> | undefined;
    let evidenceTimer: ReturnType<typeof setTimeout> | undefined;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;

    function commit(update: (previous: CityRunData) => CityRunData) {
      if (!disposed) setData(previous => previous.key === key ? update(previous) : previous);
    }

    function watchRecordingProgress() {
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => fail("The run recording is taking too long to load. Check your connection and try again."), 20000);
    }

    function fail(message: string, clearPrivateData = false) {
      if (disposed) return;
      stopped = true;
      controller?.abort();
      clearTimeout(retryTimer);
      clearTimeout(evidenceTimer);
      clearTimeout(loadTimer);
      commit(previous => ({ ...(clearPrivateData ? emptyData(key, false) : previous), loading: false, connectionLost: null, error: message }));
    }

    function publish() {
      if (disposed || stopped || historical) return;
      clearTimeout(loadTimer);
      commit(previous => ({ ...previous, key, snapshot, events, state, loading: false, error: null }));
    }

    function scheduleEvidence(delay = 250) {
      if (disposed || stopped) return;
      clearTimeout(evidenceTimer);
      evidenceTimer = setTimeout(() => void refreshEvidence(), delay);
    }

    async function refreshEvidence() {
      if (disposed || stopped) return;
      if (evidencePending) { evidenceDirty = true; return; }
      evidencePending = true;
      let persistedTerminal = !ended;
      try {
        const run = await api.getRun(id);
        if (disposed || stopped) return;
        state = run.state ?? {};
        persistedTerminal = !activeStatuses.has(run.status);
        commit(previous => ({ ...previous, state }));
        const expectedFiles = snapshot.files.length > 0 || (Array.isArray(state.files) && state.files.length > 0);
        if (expectedFiles) {
          try {
            const tree = await api.getRunFiles(id);
            if (disposed || stopped) return;
            const files: Record<string, string> = {};
            for (const file of tree.files) files[file.path] = file.content;
            commit(previous => ({ ...previous, files, filesError: null }));
          } catch (error) {
            if (disposed || stopped) return;
            if (error instanceof ApiError && [401, 403].includes(error.status)) { fail(accessError(error.status), true); return; }
            commit(previous => ({ ...previous, filesError: "The generated files couldn’t be loaded. Try loading them again." }));
          }
        }
      } catch (error) {
        if (disposed || stopped) return;
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) { fail(accessError(error.status), true); return; }
        // Recorded events remain usable while optional artifact metadata catches up.
      } finally {
        evidencePending = false;
        if (!disposed && !stopped && (evidenceDirty || (ended && !persistedTerminal && terminalRefreshes++ < 3))) {
          evidenceDirty = false;
          scheduleEvidence(750);
        }
      }
    }

    refreshRef.current = () => scheduleEvidence(0);

    function handleFrame(frame: string) {
      let eventId: number | null = null;
      let name: string | null = null;
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("id:")) eventId = Number(line.slice(3).trim());
        else if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length || (eventId != null && Number.isFinite(eventId) && eventId <= lastEventId)) return;
      try {
        const raw = JSON.parse(dataLines.join("\n"));
        if (!raw || typeof raw !== "object") return;
        const event = { ...raw, event: raw.event ?? name } as CodeForgeEvent;
        if (!eventNames.has(event.event) || typeof event.at !== "string") return;
        const next = { ...applyEvent(snapshot, event), lastEventAt: event.at };
        if (eventId != null && Number.isFinite(eventId)) lastEventId = eventId;
        snapshot = next;
        events = [...events, event];
        attempt = 0;
        emptyConnections = 0;
        if (historical) watchRecordingProgress();
        if (event.event === "run.completed" || event.event === "run.failed") {
          ended = true;
          historical = false;
          commit(previous => ({ ...previous, connectionLost: null }));
          controller?.abort();
        }
        publish();
        if (["file.written", "agent.completed", "approval.required", "approval.resolved", "run.completed", "run.failed"].includes(event.event)) scheduleEvidence(ended ? 0 : 250);
      } catch {
        // A malformed frame is skipped without discarding the earlier recording.
      }
    }

    async function connect() {
      if (disposed || stopped || ended) return;
      controller = new AbortController();
      const startingEventId = lastEventId;
      try {
        const response = await fetch(`${API_BASE_URL}/runs/${id}/stream`, {
          headers: { "Last-Event-ID": String(lastEventId) }, signal: controller.signal,
        });
        if (disposed || stopped) return;
        if ([401, 403, 404].includes(response.status)) { fail(accessError(response.status), true); return; }
        if (!response.ok || !response.body) throw new Error("Stream unavailable");
        commit(previous => ({ ...previous, connectionLost: null }));
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!disposed && !stopped && !ended) {
          staleTimer = setTimeout(() => controller?.abort(), 45000);
          const { value, done } = await reader.read();
          clearTimeout(staleTimer);
          if (done) break;
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
          let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) >= 0) {
            handleFrame(buffer.slice(0, boundary));
            buffer = buffer.slice(boundary + 2);
            if (ended || stopped) break;
          }
        }
      } catch {
        if (disposed || stopped || ended) return;
      } finally {
        clearTimeout(staleTimer);
      }
      if (disposed || stopped || ended) return;
      if (lastEventId === startingEventId) emptyConnections++;
      if ((events.length === 0 || historical) && emptyConnections >= 5) { fail("No further run activity could be loaded. Check your connection and try again."); return; }
      attempt++;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);
      commit(previous => ({ ...previous, connectionLost: { attempt, retryInSeconds: delay / 1000 } }));
      retryTimer = setTimeout(() => void connect(), delay);
    }

    async function initialize() {
      try {
        const run = await api.getRun(id);
        if (disposed || stopped) return;
        state = run.state ?? {};
        historical = !activeStatuses.has(run.status);
        if (!historical) snapshot = { ...snapshot, runId: id, prompt: run.prompt, status: run.status };
        commit(previous => ({ ...previous, state }));
        publish();
        if (Array.isArray(state.files) && state.files.length) scheduleEvidence(0);
      } catch (error) {
        if (disposed || stopped) return;
        fail(error instanceof ApiError && [401, 403, 404].includes(error.status) ? accessError(error.status) : "The run couldn’t be opened. Check your connection and try again.", true);
        return;
      }
      void connect();
    }

    watchRecordingProgress();
    void initialize();
    return () => {
      disposed = true;
      refreshRef.current = null;
      controller?.abort();
      clearTimeout(retryTimer);
      clearTimeout(staleTimer);
      clearTimeout(evidenceTimer);
      clearTimeout(loadTimer);
    };
  }, [runId, generation, key]);

  const current = data.key === key ? data : emptyData(key, Boolean(runId));
  return { ...current, retry, refreshFiles };
}

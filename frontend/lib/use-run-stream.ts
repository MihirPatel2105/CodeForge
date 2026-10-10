"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "./api";
import { applyEvent, initialSnapshot, type RunSnapshot } from "./run-reducer";
import type { CodeForgeEvent } from "./types";

export interface ConnectionLostInfo {
  attempt: number;
  retryInSeconds: number;
}

const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 15000;

/**
 * Live events for one run (docs/STATE_AND_API.md §4, `GET /runs/{id}/stream`).
 *
 * This reads the `text/event-stream` body through the same-origin proxy over `fetch`.
 * Reconnects are our
 * own responsibility rather than the browser's — done here with `Last-Event-ID` plus
 * exponential backoff, mirroring what a native EventSource would do (CLAUDE.md gotcha
 * "SSE connections drop... reconnect + replay from last event id").
 */
export function useRunStream(runId: string) {
  const [snapshot, setSnapshot] = useState<RunSnapshot>(initialSnapshot);
  const [connectionLost, setConnectionLost] = useState<ConnectionLostInfo | null>(null);

  const refreshRef = useRef<(() => void) | null>(null);
  const refresh = useCallback(() => refreshRef.current?.(), []);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let lastEventId = 0;
    let terminalSeen = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let staleTimer: ReturnType<typeof setTimeout> | null = null;
    let resyncRequested = false;
    let abortController: AbortController | null = null;

    function handleFrame(frame: string) {
      let id: number | null = null;
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.length === 0 || line.startsWith(":")) continue; // blank / heartbeat comment
        if (line.startsWith("id:")) id = Number(line.slice(3).trim());
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) return;
      try {
        const event = JSON.parse(dataLines.join("\n")) as CodeForgeEvent;
        if (id != null && Number.isFinite(id)) {
          if (id <= lastEventId) return;
          lastEventId = id;
        }
        setSnapshot((prev) => ({ ...applyEvent(prev, event), lastEventAt: event.at }));
        if (event.event === "run.completed" || event.event === "run.failed") {
          terminalSeen = true;
          setConnectionLost(null);
          abortController?.abort();
        }
      } catch {
        // A malformed frame shouldn't take the whole stream down.
      }
    }

    async function connect() {
      retryTimer = null;
      if (cancelled || terminalSeen) return;
      abortController = new AbortController();

      try {
        const res = await fetch(`${API_BASE_URL}/runs/${runId}/stream`, {
          headers: {
            "Last-Event-ID": String(lastEventId),
          },
          signal: abortController.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`);

        attempt = 0;
        setConnectionLost(null);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          // Heartbeats arrive every 15s. An open but silent connection must recover too.
          staleTimer = setTimeout(() => abortController?.abort(), 45000);
          const { value, done } = await reader.read();
          clearTimeout(staleTimer);
          staleTimer = null;
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            handleFrame(buffer.slice(0, sep));
            buffer = buffer.slice(sep + 2);
          }
        }
      } catch {
        if (cancelled || terminalSeen) return;
      } finally {
        if (staleTimer) clearTimeout(staleTimer);
      }

      if (cancelled || terminalSeen) return;
      // The stream ended (server closed it, network dropped, proxy timed out) —
      // reconnect with backoff; the server replays everything after `lastEventId`.
      attempt += 1;
      const delayMs = resyncRequested ? 0 : Math.min(BASE_RETRY_MS * 2 ** (attempt - 1), MAX_RETRY_MS);
      resyncRequested = false;
      setConnectionLost(delayMs === 0 ? null : { attempt, retryInSeconds: Math.round(delayMs / 1000) });
      retryTimer = setTimeout(connect, delayMs);
    }

    refreshRef.current = () => {
      if (cancelled || terminalSeen) return;
      resyncRequested = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
        resyncRequested = false;
        void connect();
      } else abortController?.abort();
    };
    void connect();
    return () => {
      refreshRef.current = null;
      cancelled = true;
      abortController?.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (staleTimer) clearTimeout(staleTimer);
    };
  }, [runId]);

  return { snapshot, connectionLost, refresh };
}

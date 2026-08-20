"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, getToken } from "./api";
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
 * Not built on the native `EventSource` API: the backend authenticates with a bearer
 * token, and `EventSource` cannot send custom headers. This reads the same
 * `text/event-stream` body by hand over `fetch`, which also means reconnects are our
 * own responsibility rather than the browser's — done here with `Last-Event-ID` plus
 * exponential backoff, mirroring what a native EventSource would do (CLAUDE.md gotcha
 * "SSE connections drop... reconnect + replay from last event id").
 */
export function useRunStream(runId: string) {
  const [snapshot, setSnapshot] = useState<RunSnapshot>(initialSnapshot);
  const [connectionLost, setConnectionLost] = useState<ConnectionLostInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let lastEventId = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
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
      if (id != null && Number.isFinite(id)) lastEventId = id;
      try {
        const event = JSON.parse(dataLines.join("\n")) as CodeForgeEvent;
        setSnapshot((prev) => applyEvent(prev, event));
      } catch {
        // A malformed frame shouldn't take the whole stream down.
      }
    }

    async function connect() {
      if (cancelled) return;
      abortController = new AbortController();

      try {
        const token = getToken();
        const res = await fetch(`${API_BASE_URL}/runs/${runId}/stream`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            handleFrame(buffer.slice(0, sep));
            buffer = buffer.slice(sep + 2);
          }
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
      }

      if (cancelled) return;
      // The stream ended (server closed it, network dropped, proxy timed out) —
      // reconnect with backoff; the server replays everything after `lastEventId`.
      attempt += 1;
      const delayMs = Math.min(BASE_RETRY_MS * 2 ** (attempt - 1), MAX_RETRY_MS);
      setConnectionLost({ attempt, retryInSeconds: Math.round(delayMs / 1000) });
      retryTimer = setTimeout(connect, delayMs);
    }

    connect();
    return () => {
      cancelled = true;
      abortController?.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [runId]);

  return { snapshot, connectionLost };
}

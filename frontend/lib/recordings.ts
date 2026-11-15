import booksClean from "./recordings/books-clean.json";
import booksReviewLoop from "./recordings/books-review-loop.json";
import type { CodeForgeEvent, FileHistoryVersion } from "./types";

/**
 * Recorded replays: real runs exported by `backend/scripts/export_recording.py` and
 * committed here, so `/replay/<slug>` can play one with no backend, database or LLM call
 * — the demo fallback for when provider quota or the network gives out.
 */

/** Matches `RECORDING_VERSION` in the export script. */
export const RECORDING_VERSION = 1;

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export interface RunRecording {
  slug: string;
  title: string;
  sourceRunId: string;
  recordedAt: string;
  prompt: string;
  events: CodeForgeEvent[];
  files: Record<string, string>;
  history: FileHistoryVersion[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringMap(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function requireString(raw: Record<string, unknown>, key: string, source: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Recording ${source}: "${key}" must be a non-empty string`);
  }
  return value;
}

function parseEvents(value: unknown, source: string): CodeForgeEvent[] {
  const valid =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isRecord(item) && typeof item.event === "string" && typeof item.at === "string");
  if (!valid) throw new Error(`Recording ${source}: "events" must be a non-empty list of events`);
  const events = value as CodeForgeEvent[];
  if (events[events.length - 1].event !== "run.completed") {
    throw new Error(`Recording ${source}: the event log must end with run.completed`);
  }
  return events;
}

function parseHistory(value: unknown, source: string): FileHistoryVersion[] {
  const valid =
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && Number.isInteger(item.iteration) && isStringMap(item.files));
  if (!valid) throw new Error(`Recording ${source}: "history" is malformed`);
  return value.map((item) => ({
    iteration: item.iteration as number,
    files: Object.entries(item.files as Record<string, string>).map(([path, content]) => ({ path, content })),
  }));
}

/** Validate an exported file; these are committed data, but never trusted blindly. */
export function parseRecording(raw: unknown, source: string): RunRecording {
  if (!isRecord(raw)) throw new Error(`Recording ${source}: not an object`);
  if (raw.version !== RECORDING_VERSION) {
    throw new Error(`Recording ${source}: version ${String(raw.version)} is not ${RECORDING_VERSION}`);
  }
  const slug = requireString(raw, "slug", source);
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Recording ${source}: slug "${slug}" is not URL-safe`);
  const recordedAt = requireString(raw, "recorded_at", source);
  if (Number.isNaN(Date.parse(recordedAt))) throw new Error(`Recording ${source}: "recorded_at" is not a date`);
  if (!isStringMap(raw.files)) throw new Error(`Recording ${source}: "files" must map paths to text`);

  return {
    slug,
    title: requireString(raw, "title", source),
    sourceRunId: requireString(raw, "source_run_id", source),
    recordedAt,
    prompt: requireString(raw, "prompt", source),
    events: parseEvents(raw.events, source),
    files: raw.files,
    history: parseHistory(raw.history, source),
  };
}

const RECORDINGS: readonly RunRecording[] = [
  parseRecording(booksClean, "books-clean.json"),
  parseRecording(booksReviewLoop, "books-review-loop.json"),
];

export function listRecordings(): readonly RunRecording[] {
  return RECORDINGS;
}

export function getRecording(slug: string): RunRecording | null {
  return RECORDINGS.find((recording) => recording.slug === slug) ?? null;
}

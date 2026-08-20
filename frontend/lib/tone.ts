/**
 * Semantic tones shared across the dashboard: agent card pills, status chips, the
 * timeline, the result summary. One place to look up what "warn" means in Tailwind
 * classes, so every component agrees.
 *
 * `loop` is listed separately and is spent only on the loop itself — see the
 * discipline note in app/globals.css. Never reach for it as a generic "purple" tone.
 */

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "loop";

interface ToneClasses {
  /** Tinted pill / badge: soft fill + matching text. */
  soft: string;
  /** Border for a card or panel in this tone. */
  border: string;
  /** Foreground-only text in this tone. */
  text: string;
}

export const tone: Record<Tone, ToneClasses> = {
  neutral: {
    soft: "bg-surface-2 text-fg-muted",
    border: "border-border",
    text: "text-fg-muted",
  },
  accent: {
    soft: "bg-accent-soft text-accent",
    border: "border-accent-bd",
    text: "text-accent",
  },
  ok: {
    soft: "bg-ok-soft text-ok",
    border: "border-ok-bd",
    text: "text-ok",
  },
  warn: {
    soft: "bg-warn-soft text-warn",
    border: "border-warn-bd",
    text: "text-warn",
  },
  danger: {
    soft: "bg-danger-soft text-danger",
    border: "border-danger-bd",
    text: "text-danger",
  },
  loop: {
    soft: "bg-loop-soft text-loop",
    border: "border-loop-bd",
    text: "text-loop",
  },
};

/**
 * Run outcome -> on-screen label and tone (UI_BRIEF §5, verbatim vocabulary).
 * `failed_max_loops` is `warn`, deliberately never `danger`: it is a designed stop
 * after three attempts with the work kept, not a crash.
 */
export const RUN_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  queued: { label: "queued", tone: "neutral" },
  running: { label: "running", tone: "accent" },
  awaiting_approval: { label: "awaiting approval", tone: "warn" },
  succeeded: { label: "succeeded", tone: "ok" },
  /** Derived client-side, never sent by the backend — see `displayStatus` below. Kept
   * here too so components that need the short chip label (result summary) don't have
   * to re-derive `displayStatus`'s longer combined string. */
  partial: { label: "partial", tone: "warn" },
  failed_max_loops: { label: "failed — loop limit reached", tone: "warn" },
  failed_sandbox: { label: "failed — sandbox error", tone: "danger" },
  failed_llm: { label: "failed — AI providers unavailable", tone: "danger" },
  rejected: { label: "rejected", tone: "neutral" },
  cancelled: { label: "cancelled", tone: "neutral" },
};

/**
 * `partial` is not yet a value the backend's RunStatus emits (see
 * design_handoff/README.md "two deliberate calls"). Derived client-side rather than
 * added to the contract: a run whose top-level status is `succeeded` but whose tests
 * did not all pass is displayed as partial, in warn tone — never as an error.
 */
export function displayStatus(
  status: string,
  testsOk: boolean | null,
): { label: string; tone: Tone } {
  if (status === "succeeded" && testsOk === false) {
    return { label: "partial — code runs, some tests fail", tone: "warn" };
  }
  return RUN_STATUS_META[status] ?? { label: status, tone: "neutral" };
}

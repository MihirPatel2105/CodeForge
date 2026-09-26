"use client";

import { useState } from "react";
import { PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";
import type { ApprovalSnapshot } from "@/lib/run-reducer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ApprovalBarProps {
  approval: ApprovalSnapshot;
  onApprove: (note: string) => void;
  onReject: (note: string) => void;
}

const PHASE_TITLE: Record<string, string> = {
  pm: "Requirements from the PM",
  architect: "Design from the Architect",
  final: "Final review",
};

interface FactChip {
  label: string;
  value: string;
}

/** PM and Architect payloads get fixed, human labels (design_handoff/README.md
 * "Approval bar") since those are the two phases the pipeline actually pauses on;
 * anything else falls back to humanised keys rather than raw JSON. */
function factChips(phase: string, payload: Record<string, unknown>): FactChip[] {
  const val = (v: unknown): string | null => {
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    if (Array.isArray(v)) return v.join(", ");
    return null;
  };

  if (phase === "pm") {
    return [
      { label: "Project", value: val(payload.project_name) },
      { label: "Entity", value: val(payload.entity) },
      { label: "Operations", value: val(payload.operations) },
    ].filter((c): c is FactChip => c.value != null);
  }
  if (phase === "architect") {
    return [
      { label: "Endpoints", value: val(payload.endpoints) },
      { label: "Collection", value: val(payload.collection) },
      { label: "Files planned", value: val(payload.files_planned) },
    ].filter((c): c is FactChip => c.value != null);
  }
  return Object.entries(payload)
    .map(([key, v]) => ({ label: key.replace(/_/g, " "), value: val(v) }))
    .filter((c): c is FactChip => c.value != null);
}

/** The paused checkpoint sits immediately after the run summary so it is visible
 * before the user starts inspecting the long evidence workbench. */
export function ApprovalBar({ approval, onApprove, onReject }: ApprovalBarProps) {
  const [note, setNote] = useState("");
  const chips = factChips(approval.phase, approval.payload);
  const title = PHASE_TITLE[approval.phase] ?? `Approval — ${approval.phase}`;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border-2 border-warn bg-surface shadow-[0_16px_38px_rgba(156,86,5,.11)]" aria-labelledby="approval-heading">
      <div
        aria-hidden
        className="h-1 motion-safe:animate-[cfShift_0.8s_linear_infinite]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, var(--warn) 0 12px, transparent 12px 24px)",
        }}
      />
      <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-warn-soft">
            <PauseCircle
              className="h-5 w-5 text-warn motion-safe:animate-[cfDot_1.6s_ease-in-out_infinite]"
              aria-hidden
            />
          </span>
          <div className="flex flex-col gap-[2px]">
            <span className={cn(typeScale.label, "text-warn")}>AWAITING APPROVAL</span>
            <h2 id="approval-heading" className="text-[19px] font-[700] tracking-[-0.03em] text-fg">{title}</h2>
          </div>
        </div>

        <div className="hidden h-9 w-px shrink-0 bg-border lg:block" aria-hidden />

        <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2">
          {chips.map((chip) => (
            <div key={chip.label} className="flex flex-col gap-[2px]">
              <span className={cn(typeScale.label, "text-[10.5px] text-fg-faint")}>
                {chip.label}
              </span>
              <span className="text-[13.5px] font-[550] text-fg">{chip.value}</span>
            </div>
          ))}
        </div>

        <div className="w-full min-w-0 sm:w-auto sm:flex-1 lg:max-w-[240px]">
          <label htmlFor="approval-note" className={cn(typeScale.label, "mb-1.5 block text-fg-muted")}>Note to agents (optional)</label>
          <Input
            id="approval-note"
            name="approval_note"
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add context for the next step…"
            className="h-11 rounded-lg border-border-strong bg-bg text-[15px]"
          />
        </div>

        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0 sm:self-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onReject(note)}
            className="h-11 flex-1 rounded-lg border-border-strong px-4 text-[13px] text-danger hover:bg-danger-soft sm:flex-none"
          >
            Reject
          </Button>
          <Button
            type="button"
            onClick={() => onApprove(note)}
            className="h-11 flex-1 rounded-lg px-5 text-[13px] sm:flex-none"
          >
            Approve
          </Button>
        </div>
      </div>
    </section>
  );
}

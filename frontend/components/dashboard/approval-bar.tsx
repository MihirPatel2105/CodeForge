"use client";

import { useState } from "react";
import { PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";
import type { ApprovalSnapshot } from "@/lib/run-reducer";

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

/** Twice per run the pipeline pauses and waits for a human (docs/UI_BRIEF.md §4.4) —
 * this must be unmissable, hence the hazard band and the sticky position above the
 * playback/nav bar rather than inline in the flow. */
export function ApprovalBar({ approval, onApprove, onReject }: ApprovalBarProps) {
  const [note, setNote] = useState("");
  const chips = factChips(approval.phase, approval.payload);
  const title = PHASE_TITLE[approval.phase] ?? `Approval — ${approval.phase}`;

  return (
    <div className="sticky bottom-[56px] z-10 mx-[22px] overflow-hidden rounded-[4px] border-2 border-warn bg-surface shadow-[0_-6px_26px_rgba(20,22,26,.13)]">
      <div
        aria-hidden
        className="h-1 motion-safe:animate-[cfShift_0.8s_linear_infinite]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, var(--warn) 0 12px, transparent 12px 24px)",
        }}
      />
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-warn-soft">
            <PauseCircle
              className="h-5 w-5 text-warn motion-safe:animate-[cfDot_1.6s_ease-in-out_infinite]"
              aria-hidden
            />
          </span>
          <div className="flex flex-col gap-[2px]">
            <span className={cn(typeScale.label, "text-warn")}>AWAITING APPROVAL</span>
            <span className="text-[16.5px] font-[650] text-fg">{title}</span>
          </div>
        </div>

        <div className="h-9 w-px shrink-0 bg-border" aria-hidden />

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

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note for the agents…"
          className="h-9 w-[210px] shrink-0 rounded-[3px] border border-border-strong bg-bg px-3 text-[13px] text-fg placeholder:text-fg-faint focus:outline-none"
        />

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onReject(note)}
            className="rounded-[3px] border border-border-strong px-[14px] py-[9px] text-[13.5px] font-[650] text-danger hover:bg-danger-soft"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onApprove(note)}
            className="rounded-[3px] bg-fg px-[16px] py-[9px] text-[14px] font-[700] text-surface"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

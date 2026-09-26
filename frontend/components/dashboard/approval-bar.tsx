"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
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
    <section className="mt-5 overflow-hidden rounded-[24px] border border-warn-bd bg-white shadow-[0_18px_48px_rgba(64,48,25,0.09)]" aria-labelledby="approval-heading">
      <div className="flex items-start gap-3.5 border-b border-warn-bd/65 bg-[#fffaf3] px-5 py-4 sm:px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-warn-bd bg-white text-warn">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <span className={cn(typeScale.label, "text-warn")} role="status">Awaiting your approval</span>
          <h2 id="approval-heading" className="mt-0.5 text-[19px] font-[700] tracking-[-0.03em] text-fg">{title}</h2>
          <p className="mt-1 text-[13px] leading-5 text-fg-muted">Review this checkpoint before the agents continue.</p>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="grid gap-2 px-5 py-4 sm:grid-cols-3 sm:px-6">
          {chips.map((chip) => (
            <div key={chip.label} className="min-w-0 rounded-xl border border-border bg-surface-2/45 px-3.5 py-2.5">
              <span className={cn(typeScale.label, "block text-[10.5px] text-fg-faint")}>{chip.label}</span>
              <span className="mt-1 block break-words text-[13.5px] font-[600] leading-5 text-fg">{chip.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border bg-surface-2/40 px-5 py-4 sm:px-6 lg:flex-row lg:items-end lg:gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor="approval-note" className={cn(typeScale.label, "mb-1.5 block text-fg-muted")}>Note to agents (optional)</label>
          <Input
            id="approval-note"
            name="approval_note"
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add context for the next step…"
            className="h-11 rounded-xl border-border-strong bg-white text-[14px]"
          />
        </div>

        <div className="flex gap-2 lg:shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onReject(note)}
            className="h-11 flex-1 rounded-xl border-border-strong px-5 text-[13px] text-danger hover:bg-danger-soft motion-safe:transition-transform motion-safe:duration-150 motion-safe:active:scale-[0.98] lg:flex-none"
          >
            Reject
          </Button>
          <Button
            type="button"
            onClick={() => onApprove(note)}
            className="h-11 flex-1 rounded-xl px-6 text-[13px] motion-safe:transition-transform motion-safe:duration-150 motion-safe:active:scale-[0.98] lg:flex-none"
          >
            Approve
          </Button>
        </div>
      </div>
    </section>
  );
}

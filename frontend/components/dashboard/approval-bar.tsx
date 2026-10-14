"use client";

import { useId, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";
import type { ApprovalSnapshot } from "@/lib/run-reducer";
import { Button } from "@/components/ui/button";
import { ApprovalDetails } from "./approval-details";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import "./run-dashboard.css";

export interface ApprovalBarProps {
  approval: ApprovalSnapshot;
  onApprove: (note: string) => Promise<boolean>;
  onReject: (note: string) => Promise<boolean>;
  onRevise?: (note: string) => Promise<boolean>;
  busy?: boolean;
  error?: string | null;
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
export function ApprovalBar({ approval, onApprove, onReject, onRevise, busy = false, error }: ApprovalBarProps) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const [pending, setPending] = useState<"approve" | "reject" | "revise" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const locked = busy || pending !== null || submitted;
  async function decide(action: "approve" | "reject" | "revise") {
    if (locked) return;
    const callback = action === "approve" ? onApprove : action === "reject" ? onReject : onRevise;
    if (!callback) return;
    setPending(action);
    try {
      if (await callback(note)) {
        setSubmitted(true);
        setOpen(false);
      }
    } finally { setPending(null); }
  }
  const chips = factChips(approval.phase, approval.payload);
  const title = PHASE_TITLE[approval.phase] ?? `Approval — ${approval.phase}`;

  return (
    <Dialog open={open} onOpenChange={next => { if (!locked) setOpen(next); }}>
      <section className="cf-approval-compact" aria-label="Approval checkpoint">
        <div><ShieldCheck size={18} aria-hidden /><span><strong>{submitted ? "Decision submitted" : "Approval needed"}</strong><span>{title}</span></span></div>
        <DialogTrigger disabled={locked} render={<Button variant="outline" />}>{submitted ? "Updating run…" : "Review & approve →"}</DialogTrigger>
      </section>
      <DialogContent className="cf-approval-dialog" showCloseButton={!locked}>
      <div className="cf-approval-review">
      <div className="flex items-start gap-3.5 border-b border-warn-bd/65 bg-warn-soft px-5 py-4 sm:px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-warn-bd bg-surface text-warn">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <span className={cn(typeScale.label, "text-warn")} role="status">Awaiting your approval</span>
          <DialogTitle className="mt-0.5 text-[19px] font-[700] tracking-[-0.03em] text-fg">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] leading-5 text-fg-muted">Review this checkpoint before the agents continue.</DialogDescription>
        </div>
      </div>

      <div className="cf-approval-scroll">
      {chips.length > 0 && (
        <div className="cf-approval-facts grid gap-2 px-5 py-4 sm:grid-cols-3 sm:px-6">
          {chips.map((chip) => (
            <div key={chip.label} className="min-w-0 rounded-2xl border border-border bg-surface-2/45 px-3.5 py-2.5">
              <span className={cn(typeScale.label, "block text-[10.5px] text-fg-faint")}>{chip.label}</span>
              <span className="mt-1 block break-words text-[13.5px] font-[600] leading-5 text-fg">{chip.value}</span>
            </div>
          ))}
        </div>
      )}

      <ApprovalDetails details={approval.payload.details} />
      <p className="px-5 pb-3 text-sm text-fg-muted sm:px-6">Approve to continue. Request changes to review a revised plan. Reject ends this run. {Number(approval.payload.revisions_used || 0)}/3 revisions used.</p>
      </div>
      <div className="cf-approval-actions flex flex-col gap-3 border-t border-border bg-surface-2/40 px-5 py-4 sm:px-6 lg:flex-row lg:items-end lg:gap-4">
        {error && <Notice>{error}</Notice>}
        <div className="min-w-0 flex-1">
          <label htmlFor={noteId} className={cn(typeScale.label, "mb-1.5 block text-fg-muted")}>Note to agents (optional)</label>
          <Input
            id={noteId}
            name="approval_note"
            autoComplete="off"
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add context for the next step…"
            className="h-11 rounded-2xl border-border-strong bg-surface text-[14px]"
          />
        </div>

        <div className="flex flex-wrap gap-2 lg:shrink-0">
          {onRevise && <Button variant="outline" disabled={locked || note.trim().length < 3 || Number(approval.payload.revisions_used || 0) >= 3} onClick={() => void decide("revise")} className="h-11 rounded-2xl">{pending === "revise" ? "Requesting changes…" : "Request changes"}</Button>}
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={() => void decide("reject")}
            className="h-11 flex-1 rounded-2xl border-border-strong px-5 text-[13px] text-danger hover:bg-danger-soft motion-safe:transition-transform motion-safe:duration-150 motion-safe:active:scale-[0.98] lg:flex-none"
          >
            {pending === "reject" ? "Rejecting…" : "Reject"}
          </Button>
          <Button
            type="button"
            disabled={locked}
            onClick={() => void decide("approve")}
            className="h-11 flex-1 rounded-2xl px-6 text-[13px] motion-safe:transition-transform motion-safe:duration-150 motion-safe:active:scale-[0.98] lg:flex-none"
          >
            {pending === "approve" ? "Approving…" : "Approve"}
          </Button>
        </div>
      </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}

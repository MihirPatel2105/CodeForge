"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Cloud, CloudUpload, Download, LoaderCircle, RefreshCw } from "lucide-react";
import { useMotionPreference } from "@/lib/use-motion-preference";

type Kind = "download" | "publish" | "reload";
type State = "idle" | "pending" | "success";

// Adapted from Amicro's icon morph and rotate interactions; see docs/vendor/amicro.md.
// Feedback is driven by the caller's real action state, never by hover.
export function ActionIcon({ kind, state = "idle" }: { kind: Kind; state?: State }) {
  const reduced = useMotionPreference();
  const Icon = state === "success" ? Check : kind === "reload" ? RefreshCw : state === "pending" ? kind === "publish" ? CloudUpload : LoaderCircle : kind === "download" ? Download : Cloud;
  return <span aria-hidden="true" data-action-icon={kind} data-action-state={state} className="relative inline-grid size-4 shrink-0 place-items-center">
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={`${kind}-${state}`} className="col-start-1 row-start-1 inline-grid place-items-center"
        initial={reduced ? false : { scale: .5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: reduced ? 1 : .5, opacity: 0 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 600, damping: 25 }}>
        <motion.span className="inline-grid place-items-center" animate={state === "pending" && kind === "publish" && !reduced ? { y: [0, -2, 0] } : { y: 0 }} transition={{ duration: .9, repeat: state === "pending" && kind === "publish" && !reduced ? Infinity : 0 }}>
          <Icon className={`size-4 ${state === "pending" && kind !== "publish" ? "motion-safe:animate-spin" : state === "idle" && kind === "reload" ? "transition-transform duration-300 motion-safe:group-hover:rotate-180 motion-safe:group-focus-visible:rotate-180" : state === "idle" && kind === "download" ? "transition-transform duration-200 motion-safe:group-hover:translate-y-0.5" : ""}`} />
        </motion.span>
      </motion.span>
    </AnimatePresence>
  </span>;
}

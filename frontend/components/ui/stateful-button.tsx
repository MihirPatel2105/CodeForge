"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { motion } from "motion/react";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ActionIcon } from "@/components/ui/action-icon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMotionPreference } from "@/lib/use-motion-preference";

type Props = Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
  label: string;
  pendingLabel: string;
  successLabel?: string;
  icon?: ReactNode;
  actionKind?: "publish" | "reload";
  onAction: () => boolean | Promise<boolean>;
};

export function StatefulButton({ label, pendingLabel, successLabel = "Done", icon, actionKind, onAction, disabled, className, ...props }: Props) {
  const [state, setState] = useState<"idle" | "pending" | "success">("idle");
  const pending = useRef(false);
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); };
  }, []);

  async function act() {
    if (pending.current || disabled) return;
    pending.current = true;
    if (timer.current) clearTimeout(timer.current);
    setState("pending");
    try {
      const succeeded = await onAction();
      if (!mounted.current) return;
      setState(succeeded ? "success" : "idle");
      if (succeeded) timer.current = setTimeout(() => setState("idle"), 1600);
    } catch {
      if (mounted.current) {
        setState("idle");
        toast.error("Couldn't complete this action. Please try again.");
      }
    } finally { pending.current = false; }
  }

  const text = state === "pending" ? pendingLabel : state === "success" ? successLabel : label;
  return (
    <Button {...props} className={cn("group", className)} type={props.type ?? "button"} disabled={disabled || state === "pending"}
      aria-label={label} aria-busy={state === "pending"} onClick={() => void act()}>
      <span aria-hidden="true" className="inline-grid items-center">
        {[label, pendingLabel, successLabel].map((value, index) => (
          <span key={index} className="invisible col-start-1 row-start-1 inline-flex items-center gap-2">
            <span className="size-4" />{value}
          </span>
        ))}
        <motion.span key={actionKind ? "action" : state} className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
          initial={reduced ? false : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.15 }}>
          {actionKind ? <ActionIcon kind={actionKind} state={state} /> : state === "pending" ? <LoaderCircle className="size-4 motion-safe:animate-spin" />
            : state === "success" ? <Check className="size-4" /> : icon}
          {text}
        </motion.span>
      </span>
      <span className="sr-only" role="status">{state === "idle" ? "" : text}</span>
    </Button>
  );
}

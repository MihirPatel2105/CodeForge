"use client";

import { useEffect, type ReactNode } from "react";
import { pausePageScroll } from "@/components/layout/app-scroll";
import { Trash2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import "./deletion.css";

export function DeletionDialog({ open, onClose, busy, title, description, target, targetLabel, impact, children }: {
  open: boolean; onClose: () => void; busy: boolean; title: string; description: string;
  target: string; targetLabel: string; impact: string; children: ReactNode;
}) {
  useEffect(() => {
    if (open) return pausePageScroll();
  }, [open]);

  return <Dialog open={open} onOpenChange={next => { if (!next && !busy) onClose(); }}>
    <DialogContent className="cf-deletion-dialog" data-lenis-prevent showCloseButton={!busy}>
      <header className="cf-deletion-heading">
        <span className="cf-deletion-icon"><Trash2 size={22} strokeWidth={1.5} aria-hidden /></span>
        <span className="cf-deletion-eyebrow">Permanent action</span>
        <DialogTitle className="cf-deletion-title">{title}</DialogTitle>
        <DialogDescription className="cf-deletion-description">{description}</DialogDescription>
      </header>
      <div className="cf-deletion-target"><span>{targetLabel}</span><strong>{target}</strong></div>
      <p className="cf-deletion-impact"><AlertCircle size={15} aria-hidden /><span>{impact}</span></p>
      {children}
    </DialogContent>
  </Dialog>;
}

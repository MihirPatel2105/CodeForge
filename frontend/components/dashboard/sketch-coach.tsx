"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

interface Placement {
  card: { left: number; top: number; width: number };
  target: { left: number; top: number; width: number; height: number };
  path: string;
  arrowLeft: string;
  arrowRight: string;
}

function place(target: HTMLElement, cardHeight: number): Placement {
  const rect = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(320, vw - 32);
  const height = Math.max(170, cardHeight);
  let left: number;
  let top: number;
  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;

  if (vw < 640) {
    left = 16;
    top = Math.max(16, vh - height - 16);
    startX = left + width / 2;
    startY = top - 8;
    endX = rect.left + rect.width / 2;
    endY = Math.min(rect.bottom + 6, top - 24);
  } else if (rect.right + width + 52 < vw) {
    left = rect.right + 44;
    top = Math.max(72, Math.min(rect.top, vh - height - 16));
    startX = left - 8;
    startY = top + Math.min(height / 2, 110);
    endX = rect.right + 7;
    endY = rect.top + rect.height / 2;
  } else if (rect.left - width - 52 > 0) {
    left = rect.left - width - 44;
    top = Math.max(72, Math.min(rect.top, vh - height - 16));
    startX = left + width + 8;
    startY = top + Math.min(height / 2, 110);
    endX = rect.left - 7;
    endY = rect.top + rect.height / 2;
  } else {
    left = Math.max(16, Math.min(rect.left, vw - width - 16));
    top = rect.bottom + height + 36 < vh ? rect.bottom + 36 : Math.max(72, rect.top - height - 36);
    startX = left + width / 2;
    startY = top > rect.bottom ? top - 8 : top + height + 8;
    endX = rect.left + rect.width / 2;
    endY = top > rect.bottom ? rect.bottom + 7 : rect.top - 7;
  }

  const dx = endX - startX;
  const dy = endY - startY;
  const controlX = (startX + endX) / 2 - dy * 0.12;
  const controlY = (startY + endY) / 2 + dx * 0.12;
  const angle = Math.atan2(endY - controlY, endX - controlX);
  const wing = (delta: number) => `${endX - 13 * Math.cos(angle + delta)},${endY - 13 * Math.sin(angle + delta)}`;

  return {
    card: { left, top, width },
    target: { left: rect.left - 5, top: rect.top - 5, width: rect.width + 10, height: rect.height + 10 },
    path: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
    arrowLeft: `M ${wing(0.55)} L ${endX} ${endY}`,
    arrowRight: `M ${wing(-0.55)} L ${endX} ${endY}`,
  };
}

export function SketchCoach({
  target,
  step,
  title,
  description,
  actionLabel,
  actionDisabled,
  onAction,
  onBack,
  onSkip,
}: {
  target: string;
  step: number;
  title: string;
  description: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  onBack?: () => void;
  onSkip: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = document.querySelector<HTMLElement>(target);
        setPlacement(element ? place(element, cardRef.current?.offsetHeight ?? 188) : null);
      });
    };
    const element = document.querySelector<HTMLElement>(target);
    element?.scrollIntoView({ block: "center", behavior: "instant" });
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSkip]);

  useEffect(() => {
    const card = cardRef.current;
    if (!placement || !card) return;
    const observer = new ResizeObserver(() => {
      const element = document.querySelector<HTMLElement>(target);
      if (!element) return;
      const next = place(element, card.offsetHeight);
      if (Math.abs(next.card.top - placement.card.top) > 2) setPlacement(next);
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [placement, target]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div data-tour-step={step} className="pointer-events-none fixed inset-0 z-[70]" aria-live="polite">
      {placement && (
        <>
          <div
            className="fixed rounded-xl border-2 border-accent shadow-[0_0_0_5px_rgba(36,87,214,0.12)]"
            style={placement.target}
            aria-hidden="true"
          />
          <svg className="fixed inset-0 h-full w-full overflow-visible text-accent" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} aria-hidden="true">
            <path d={placement.path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d={placement.path} fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.35" transform="translate(2 -2)" />
            <path d={`${placement.arrowLeft} ${placement.arrowRight}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div
            ref={cardRef}
            role="dialog"
            aria-label="Getting started"
            className="pointer-events-auto fixed max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border border-accent-bd bg-surface p-5 text-fg shadow-[0_22px_60px_rgba(23,32,51,0.2)]"
            style={placement.card}
          >
            <div className="flex items-center justify-between gap-3 text-[12px] font-[650] text-accent">
              <span>Getting started</span>
              <span>{step} / 6</span>
            </div>
            <h2 className="font-display mt-3 text-[20px] font-[700] tracking-[-0.035em]">{title}</h2>
            <p className="mt-2 text-[13px] leading-[1.55] text-fg-muted">{description}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex gap-3">
                {onBack && <button type="button" onClick={onBack} className="rounded-md text-[12px] font-[650] text-fg-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent">Back</button>}
                <button type="button" onClick={onSkip} className="rounded-md text-[12px] font-[650] text-fg-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent">Skip tour</button>
              </div>
              {actionLabel && <Button type="button" size="sm" disabled={actionDisabled} onClick={onAction}>{actionLabel}</Button>}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

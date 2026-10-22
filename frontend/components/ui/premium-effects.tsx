"use client";

// Restrained React Bits adaptations; sources and license: docs/vendor/react-bits-product-effects.md.
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { motion } from "motion/react";

/** Pointer coordinates stay outside React state, so movement never rerenders the card. */
export function pointerLight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  element.style.setProperty("--light-x", `${event.clientX - bounds.left}px`);
  element.style.setProperty("--light-y", `${event.clientY - bounds.top}px`);
}

export function BlurHeadline() {
  return <h1 id="landing-title" className="cf-blur-headline">
    <span className="sr-only">Your idea. A working API.</span>
    <span aria-hidden="true">
      <span className="cf-blur-word">Your</span>{" "}<span className="cf-blur-word">idea.</span><br />
      <span className="cf-blur-word">A</span>{" "}<span className="cf-blur-word">working</span>{" "}<span className="cf-blur-word">API.</span>
    </span>
  </h1>;
}

/** Tiny progressive blur bands appear only at edges with more content beyond them. */
export function GradualScroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = viewport.current;
    const root = frame.current;
    if (!node || !root) return;
    function update() {
      if (!node || !root) return;
      root.dataset.top = String(node.scrollTop > 1);
      root.dataset.bottom = String(node.scrollHeight - node.clientHeight - node.scrollTop > 1);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    if (content.current) observer.observe(content.current);
    node.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); node.removeEventListener("scroll", update); };
  }, []);
  return <div ref={frame} className="cf-gradual-frame">
    <motion.div ref={viewport} layoutScroll className={`cf-gradual-viewport ${className}`} data-lenis-prevent><div ref={content}>{children}</div></motion.div>
    {(["top", "bottom"] as const).map(edge => <div key={edge} className={`cf-gradual-edge cf-gradual-${edge}`} aria-hidden="true">
      <span /><span /><span />
    </div>)}
  </div>;
}

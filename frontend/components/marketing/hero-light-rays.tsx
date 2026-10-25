"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SideRays from "@/components/ui/react-bits/side-rays";
import { useMotionPreference } from "@/lib/use-motion-preference";
import "./hero-light-rays.css";

export function HeroLightRays() {
  const root = useRef<HTMLDivElement>(null);
  const surfaces = useRef<{ node: HTMLElement; x: number; y: number; width: number; height: number }[]>([]);
  const lightHeight = useRef(0);
  const lastFrame = useRef(0);
  const reducedMotion = useMotionPreference();
  useEffect(() => {
    const container = root.current;
    const hero = container?.closest(".lp-hero-dark");
    if (!container || !hero || reducedMotion) return;
    let disposed = false;
    const nodes = Array.from(hero.querySelectorAll<HTMLElement>(".cf-blur-word, .lp-intro, .lp-actions .lp-button, .ol-product-shell"));
    const measure = () => {
      if (disposed) return;
      const origin = container.getBoundingClientRect();
      lightHeight.current = origin.height;
      surfaces.current = nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { node, x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const node of nodes) observer.observe(node);
    document.fonts.ready.then(measure);
    measure();
    return () => {
      disposed = true;
      observer.disconnect();
      surfaces.current = [];
      for (const node of nodes) {
        node.removeAttribute("data-ray-reflection");
        node.style.removeProperty("--reflection-x");
        node.style.removeProperty("--reflection-strength");
      }
    };
  }, [reducedMotion]);
  const reflectLight = useCallback((heading: number, focus: number, reveal: number) => {
    const now = performance.now();
    if (now - lastFrame.current < 32) return;
    lastFrame.current = now;
    const sourceX = -lightHeight.current * 0.1;
    const sourceY = -lightHeight.current * 0.12;
    const dx = Math.cos(heading);
    const dy = Math.max(0.1, -Math.sin(heading));
    for (const surface of surfaces.current) {
      const hit = sourceX + (surface.y + surface.height * 0.5 - sourceY) * dx / dy - surface.x;
      const position = Math.max(-240, Math.min(surface.width + 240, hit));
      surface.node.setAttribute("data-ray-reflection", "");
      surface.node.style.setProperty("--reflection-x", `${position.toFixed(1)}px`);
      surface.node.style.setProperty("--reflection-strength", ((0.3 + focus * 0.3) * reveal).toFixed(3));
    }
  }, []);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div ref={root} className="cf-hero-rays" aria-hidden="true">
      {ready && !reducedMotion && <SideRays
        onLightFrame={reflectLight}
        origin="top-left"
        rayColor1="#b9ceff"
        rayColor2="#6d8fff"
        followMouse
        mouseInfluence={0.5}
        maxDevicePixelRatio={1}
      />}
    </div>
  );
}

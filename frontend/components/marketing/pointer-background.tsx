"use client";

import { useEffect, useRef } from "react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { FluidBackground } from "./fluid-background";

type TrailPoint = { x: number; y: number; time: number };

export function PointerBackground({ hero }: { hero: HTMLElement }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useMotionPreference();

  useEffect(() => {
    const element = canvas.current;
    if (!element || reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    const context = element.getContext("2d");
    if (!context) return;
    let width = 0;
    let height = 0;
    let frame = 0;
    let trail: TrailPoint[] = [];
    const symbols = ["GET", "{}", "POST", "200", "API", "</>", "JSON"];
    const columnSpacing = 42;
    const rowSpacing = 26;
    const resize = () => {
      const box = element.getBoundingClientRect();
      width = box.width;
      height = box.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (now: number) => {
      frame = 0;
      context.clearRect(0, 0, width, height);
      trail = trail.filter(point => now - point.time < 1000);
      if (!trail.length || document.hidden || window.scrollY > 340) return;
      context.font = "11px monospace";
      context.textAlign = "center";
      context.fillStyle = getComputedStyle(element).color;
      const latest = trail[trail.length - 1];
      const age = Math.min(1, (now - latest.time) / 1000);
      const radius = 24 + age * 40;
      const ripple = context.createRadialGradient(latest.x, latest.y, 0, latest.x, latest.y, radius);
      ripple.addColorStop(0, `rgba(100, 100, 100, ${(1 - age) * .055})`);
      ripple.addColorStop(1, "rgba(100, 100, 100, 0)");
      context.fillStyle = ripple;
      context.fillRect(latest.x - radius, latest.y - radius, radius * 2, radius * 2);
      context.fillStyle = getComputedStyle(element).color;
      for (let y = 13; y < height; y += rowSpacing) {
        for (let x = 21; x < width; x += columnSpacing) {
          let strength = 0;
          for (const point of trail) {
            const distance = Math.hypot(x - point.x, y - point.y);
            if (distance < 64) {
              const age = 1 - (now - point.time) / 1000;
              strength = Math.max(strength, (1 - distance / 64) * age);
            }
          }
          if (strength < .035) continue;
          context.globalAlpha = strength * .28;
          const index = (Math.floor(x / columnSpacing) + Math.floor(y / rowSpacing) * 3) % symbols.length;
          context.fillText(symbols[index], x, y + Math.sin(now / 450 + x / 90) * strength * 4);
        }
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || window.scrollY > 340) return;
      const box = element.getBoundingClientRect();
      const point = { x: event.clientX - box.left, y: event.clientY - box.top, time: performance.now() };
      if (point.y < 0 || point.y > height) return;
      trail.push(point);
      if (trail.length > 8) trail.shift();
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    hero.addEventListener("pointermove", move, { passive: true });
    return () => {
      hero.removeEventListener("pointermove", move);
      observer.disconnect();
      cancelAnimationFrame(frame);
      context.clearRect(0, 0, width, height);
    };
  }, [hero, reducedMotion]);

  return <div className="hero-pointer-background" aria-hidden="true">
    <FluidBackground />
    <canvas ref={canvas} />
  </div>;
}

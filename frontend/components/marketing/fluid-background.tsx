"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useMotionPreference } from "@/lib/use-motion-preference";

/** Render a small fluid field and let the browser smoothly scale it to the hero. */
export function FluidBackground() {
  const { resolvedTheme } = useTheme();
  const canvas = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useMotionPreference();

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d", { alpha: false });
    if (!context) return;
    element.width = 160;
    element.height = 90;
    const image = context.createImageData(160, 90);
    const styles = getComputedStyle(element);
    const palette = [
      { token: "--flow-blue", fallback: [195, 195, 195] },
      { token: "--flow-ice", fallback: [246, 246, 246] },
      { token: "--flow-lilac", fallback: [225, 225, 225] },
      { token: "--flow-white", fallback: [252, 252, 252] },
    ];
    const colors = palette.map(({ token, fallback }) => {
      const channels = styles.getPropertyValue(token).trim().split(/\s+/).map(Number);
      // Stylesheets may arrive after the first client effect during development.
      return channels.length === 3 && channels.every(Number.isFinite) ? channels : fallback;
    });
    let frame = 0;
    let lastDraw = 0;
    const draw = (now: number) => {
      const time = reducedMotion ? 0 : now * .00035;
      for (let y = 0; y < 90; y++) {
        for (let x = 0; x < 160; x++) {
          const u = x / 160;
          const v = y / 90;
          const warpX = u + .2 * Math.sin(v * 4.8 + time);
          const warpY = v + .18 * Math.cos(u * 5.2 - time * .8);
          const wave = (Math.sin(warpX * 5.4 + time) + Math.cos(warpY * 4.3 - time * 1.2) + 2) / 4;
          const fold = Math.pow((Math.sin((warpX + warpY) * 7 - time * 1.7) + 1) / 2, 3);
          const shimmer = Math.sin((warpX * .8 + warpY) * 38 + time * 2) * .018;
          const blue = colors[0];
          const ice = colors[1];
          const lilac = colors[2];
          const white = colors[3];
          const index = (y * 160 + x) * 4;
          for (let channel = 0; channel < 3; channel++) {
            const base = blue[channel] * (1 - wave) + ice[channel] * wave;
            const folded = base * (1 - fold * .5) + lilac[channel] * fold * .5;
            image.data[index + channel] = folded * .85 + white[channel] * .15 + shimmer * 255;
          }
          image.data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
    };
    const tick = (now: number) => {
      frame = 0;
      if (document.hidden || window.scrollY >= 340 || reducedMotion) return;
      if (now - lastDraw >= 33) {
        draw(now);
        lastDraw = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (!frame && !reducedMotion && !document.hidden && window.scrollY < 340) {
        frame = requestAnimationFrame(tick);
      }
    };
    draw(performance.now());
    resume();
    window.addEventListener("scroll", resume, { passive: true });
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [reducedMotion, resolvedTheme]);

  return <canvas ref={canvas} className="hero-fluid-canvas" />;
}

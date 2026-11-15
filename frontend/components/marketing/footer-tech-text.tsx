"use client";

import dynamic from "next/dynamic";
import { useMotionPreference } from "@/lib/use-motion-preference";
import outlines from "./footer-wordmark-glyphs.json";
import type { GlyphOutlines } from "./tech-text";

const TechText = dynamic(() => import("./tech-text"), { ssr: false });

// The outline word is 13,620.7 font units wide (2048 per em); at this size it is 1240px, the
// static wordmark's cap, so the canvas and the static outline line up exactly.
const MAX_FONT_SIZE = 186.4;

/**
 * The footer's large wordmark: CODEFORGE in Roundex, matching the logo. The interactive letter
 * inspector draws each letter from vector outlines (footer-wordmark-glyphs.json, built by
 * scripts/brand/), and the static fallback is the outline SVG, so the site never serves the
 * Roundex font file. Decorative: the footer already names CodeForge in its logo and copyright.
 */
export function FooterTechText() {
  const reducedMotion = useMotionPreference();
  return (
    <div className="cf-footer-wordmark cf-footer-tech" aria-hidden="true">
      <span className="cf-footer-wordmark-art" data-wordmark="v4" />
      {!reducedMotion && (
        <div className="cf-footer-tech-canvas">
          <TechText text="CODEFORGE" outlines={outlines as GlyphOutlines} fontSize={MAX_FONT_SIZE}
            reach={200} softness={0.7}
            reveal="letter" lineStyle="dashed" dashLength={4} dashGap={2}
            strokeWidth={1.5} specks={15} selection labels
            draggable clickKick bounce={0.4} sweep speed={1}
            intro="none" introDuration={2} guides={false} />
        </div>
      )}
    </div>
  );
}

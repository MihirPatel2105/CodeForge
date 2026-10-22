"use client";

import dynamic from "next/dynamic";
import { useMotionPreference } from "@/lib/use-motion-preference";

const TechText = dynamic(() => import("./tech-text"), { ssr: false });

export function FooterTechText() {
  const reducedMotion = useMotionPreference();
  return (
    <div className="cf-footer-wordmark cf-footer-tech" aria-hidden="true">
      <span className="cf-footer-tech-fallback">CodeForge</span>
      {!reducedMotion && (
        <div className="cf-footer-tech-canvas">
          <TechText text="CodeForge" fontSize={172} fontWeight={600}
            letterSpacing={-0.05} reach={200} softness={0.7}
            reveal="letter" lineStyle="dashed" dashLength={4} dashGap={2}
            strokeWidth={1.5} specks={15} selection labels
            draggable clickKick bounce={0.4} sweep speed={1}
            intro="none" introDuration={2} guides={false} />
        </div>
      )}
    </div>
  );
}

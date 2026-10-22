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
          <TechText text="CodeForge" fontSize={172} fontWeight={750}
            letterSpacing={-0.05} reach={140} reveal="letter" guides
            sweep={false} draggable={false} clickKick={false} bounce={0}
            specks={8} />
        </div>
      )}
    </div>
  );
}

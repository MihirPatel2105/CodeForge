"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { useMotionPreference } from "@/lib/use-motion-preference";

const GradientASCII = dynamic(() => import("@/components/marketing/gradient-ascii"), { ssr: false });

function subscribe(onChange: () => void) {
  const desktop = window.matchMedia("(min-width: 801px)");
  desktop.addEventListener("change", onChange);
  return () => desktop.removeEventListener("change", onChange);
}

/** The landing renderer, quietened for forms; mobile uses the CSS fallback only. */
export function AuthAtmosphere() {
  const reduced = useMotionPreference();
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 801px)").matches, () => false);
  return <div className="pa-atmosphere" aria-hidden="true" data-motion={reduced ? "static" : "animated"}>
    <div className="pa-atmosphere-art">
      {desktop && <GradientASCII className="pa-ascii" speed={0.24} flicker={0} grain={0.025}
        glyphOpacity={0.65} glow={0.12} mouseInteraction={false} clickEffect="none" intro={false} paused={reduced} />}
    </div>
    <div className="pa-atmosphere-shade" />
  </div>;
}

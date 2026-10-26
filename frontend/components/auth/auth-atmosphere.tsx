"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { useMotionPreference } from "@/lib/use-motion-preference";

const SideRays = dynamic(() => import("@/components/ui/react-bits/side-rays"), { ssr: false });

function subscribe(onChange: () => void) {
  const desktop = window.matchMedia("(min-width: 801px)");
  desktop.addEventListener("change", onChange);
  return () => desktop.removeEventListener("change", onChange);
}

/** Share the hero lighting; forms retain a static fallback on mobile and reduced motion. */
export function AuthAtmosphere() {
  const reduced = useMotionPreference();
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 801px)").matches, () => false);
  return <div className="pa-atmosphere" aria-hidden="true" data-motion={reduced ? "static" : "animated"}>
    <div className="pa-atmosphere-art">
      {desktop && !reduced && <SideRays className="pa-side-rays" origin="top-left"
        rayColor1="#b9ceff" rayColor2="#6d8fff" followMouse mouseInfluence={0.5} maxDevicePixelRatio={1} />}
    </div>
    <div className="pa-atmosphere-shade" />
  </div>;
}

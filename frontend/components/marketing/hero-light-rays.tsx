"use client";

import { useEffect, useState } from "react";
import SideRays from "@/components/ui/react-bits/side-rays";
import { useMotionPreference } from "@/lib/use-motion-preference";
import "./hero-light-rays.css";

export function HeroLightRays() {
  const reducedMotion = useMotionPreference();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div className="cf-hero-rays" aria-hidden="true">
      {ready && !reducedMotion && <SideRays
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

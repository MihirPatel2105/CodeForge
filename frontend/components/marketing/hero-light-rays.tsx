"use client";

import { useEffect, useState } from "react";
import LightRays from "@/components/ui/react-bits/light-rays";
import { useMotionPreference } from "@/lib/use-motion-preference";
import "./hero-light-rays.css";

export function HeroLightRays() {
  const reducedMotion = useMotionPreference();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div className="cf-hero-rays" aria-hidden="true">
      {ready && !reducedMotion && <LightRays
        raysOrigin="top-center"
        raysColor="#b9ceff"
        raysSpeed={0.22}
        lightSpread={0.7}
        rayLength={1.65}
        rayDensity={2}
        raySharpness={0.7}
        intensity={0.95}
        glow={0.3}
        haze={0.15}
        atmosphere={0.25}
        opacity={0.9}
        followMouse
        mouseInfluence={0.1}
        cursorShadow
        clickPulse
        maxDevicePixelRatio={1}
      />}
    </div>
  );
}

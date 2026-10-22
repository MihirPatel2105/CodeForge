"use client";

import { useSyncExternalStore } from "react";
import Threads from "./threads";
import { useMotionPreference } from "@/lib/use-motion-preference";

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia("(max-width: 700px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function ThreadsBackground() {
  const reduced = useMotionPreference();
  const compact = useSyncExternalStore(subscribeToWidth, () => window.matchMedia("(max-width: 700px)").matches, () => false);
  return (
    <Threads
      className="hero-threads"
      color="#89929b"
      accentColor="#b7bec5"
      amplitude={1.5}
      distance={0.45}
      lineCount={compact ? 40 : 64}
      thickness={0.55}
      softness={0.45}
      speed={0.2}
      angle={18}
      brightness={1.5}
      fade={0.2}
      opacity={0.6}
      enableMouseInteraction={!reduced}
      parting={0.22}
      paused={reduced}
      data-motion={reduced ? "static" : "animated"}
    />
  );
}

"use client";

import Threads from "./threads";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function ThreadsBackground() {
  const reduced = useMotionPreference();
  return (
    <Threads
      className="hero-threads"
      color="#89929b"
      accentColor="#b7bec5"
      amplitude={1.5}
      distance={0.45}
      lineCount={64}
      thickness={0.65}
      softness={0.8}
      speed={0.25}
      angle={18}
      brightness={1.5}
      fade={0.2}
      opacity={0.65}
      enableMouseInteraction={!reduced}
      parting={0.35}
      paused={reduced}
      data-motion={reduced ? "static" : "animated"}
    />
  );
}

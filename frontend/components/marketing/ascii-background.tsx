"use client";

import GradientASCII from "./gradient-ascii";

export function AsciiBackground({ paused }: { paused: boolean }) {
  // Use the live demo's Atmosphere defaults, including its decoding entrance.
  return <GradientASCII className="hero-ascii" data-motion={paused ? "static" : "animated"} paused={paused} />;
}

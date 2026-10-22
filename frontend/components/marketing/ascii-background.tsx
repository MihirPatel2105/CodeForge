"use client";

import GradientASCII from "./gradient-ascii";

export function AsciiBackground({ paused }: { paused: boolean }) {
  return <GradientASCII className="hero-ascii" data-motion={paused ? "static" : "animated"}
    colors={["#163b9c", "#5275ed", "#b4ccff", "#324cb3"]}
    shape="horizon" characters=" .:+xX08#@" cellSize={15} density={0.65}
    glyphOpacity={0.7} glow={0.2} depthOfField={0.15} flicker={0}
    softness={0.65} flow={0.4} speed={0.45} gradientOpacity={0.55}
    grain={0.025} mouseInteraction={!paused} scrambleRadius={0.1}
    clickEffect="none" intro={false} dpr={1} paused={paused} />;
}

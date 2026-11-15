import type { CSSProperties } from "react";
import icon from "./icon-slabs.json";
import "./logo-assemble.css";

// Each slab arrives along the isometric axis (±30°, ±150°, ±90°) nearest to the line from the
// icon's centre to its own, so the four pieces converge rather than drop in.
const ISO_AXES = [30, 150, 90, 210, 330, 270].map((deg) => (deg * Math.PI) / 180);
const TRAVEL = 70; // icon units, of a 438 x 447 box
const STAGGER_MS = 90;

function approachFrom([cx, cy]: number[]): { dx: number; dy: number } {
  const angle = Math.atan2(cy - icon.height / 2, cx - icon.width / 2);
  const axis = ISO_AXES.reduce((best, a) =>
    Math.abs(Math.atan2(Math.sin(angle - a), Math.cos(angle - a))) <
    Math.abs(Math.atan2(Math.sin(angle - best), Math.cos(angle - best))) ? a : best);
  return { dx: Math.cos(axis) * TRAVEL, dy: Math.sin(axis) * TRAVEL };
}

const SLABS = icon.slabs.map((slab, index) => ({ ...slab, ...approachFrom(slab.centre), index }));

type Props = {
  /** Repeat assemble → hold → release for as long as it is shown (the loading state). */
  isLooping?: boolean;
  size?: number;
  /** Accessible name; omit when the mark is decorative beside visible text. */
  label?: string;
  className?: string;
};

/**
 * The CodeForge slab mark assembling itself: the four slabs slide into place along the
 * isometric axes, one after another. With reduced motion it is the finished mark, still.
 */
export function LogoAssemble({ isLooping = false, size = 48, label, className }: Props) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg
      viewBox={`0 0 ${icon.width} ${icon.height}`}
      width={size}
      height={(size * icon.height) / icon.width}
      className={["cf-assemble", className].filter(Boolean).join(" ")}
      data-looping={isLooping || undefined}
      overflow="visible"
      {...a11y}
    >
      {SLABS.map((slab) => (
        <path
          key={slab.index}
          d={slab.d}
          className="cf-assemble-slab"
          strokeWidth={icon.radius * 2}
          style={{
            "--dx": `${slab.dx.toFixed(1)}px`,
            "--dy": `${slab.dy.toFixed(1)}px`,
            "--delay": `${slab.index * STAGGER_MS}ms`,
          } as CSSProperties}
        />
      ))}
    </svg>
  );
}

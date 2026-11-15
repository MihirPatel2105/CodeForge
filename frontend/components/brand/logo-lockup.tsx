import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// The lockup artwork: the slab icon (vector, Roundex-matched corners, slabs optically weighted)
// beside the Roundex CODEFORGE wordmark, built by scripts/brand/ into one SVG per ink. Its size and the icon's share of the width drive every
// split below (the shine sweep, the scroll fold, the workspace slide), so they live here once.
const LOCKUP_WIDTH = 2285;
const LOCKUP_HEIGHT = 447;
const ICON_WIDTH = 438;

/** CodeForge lockup, sized as one piece so the icon and wordmark never drift apart. */
export function LogoLockup({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const source = variant === "dark"
    ? "/brand/codeforge-lockup-dark-v6.svg"
    : "/brand/codeforge-lockup-light-v6.svg";

  return (
    <span
      data-logo-variant={variant}
      className={cn("cf-logo-lockup pointer-events-none inline-flex select-none", className)}
      style={{
        aspectRatio: `${LOCKUP_WIDTH} / ${LOCKUP_HEIGHT}`,
        "--cf-logo-mask": `url("${source}")`,
        "--cf-logo-icon": ICON_WIDTH / LOCKUP_WIDTH,
      } as CSSProperties}
    >
      {/* SVG artwork needs no resizing, so it bypasses the image optimiser. */}
      <Image
        src={source}
        alt="CodeForge"
        draggable={false}
        width={LOCKUP_WIDTH}
        height={LOCKUP_HEIGHT}
        unoptimized
        className="h-full w-full object-contain opacity-0"
      />
      <span className="cf-logo-symbol" aria-hidden />
      <span className="cf-logo-word" aria-hidden />
    </span>
  );
}

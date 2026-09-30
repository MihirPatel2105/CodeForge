import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Supplied CodeForge identity, sized as one lockup so the mark and wordmark never drift. */
export function LogoLockup({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const source = variant === "dark"
    ? "/brand/codeforge-lockup-dark-v2.png"
    : "/brand/codeforge-lockup-light-v2.png";

  return (
    <span
      className={cn("cf-logo-lockup pointer-events-none inline-flex select-none", className)}
      style={{ aspectRatio: "1824 / 447", "--cf-logo-mask": `url("${source}")` } as CSSProperties}
    >
      <Image
        src={source}
        alt="CodeForge"
        draggable={false}
        width={1824}
        height={447}
        className="h-full w-full object-contain opacity-0"
      />
      <span className="cf-logo-symbol" aria-hidden />
      <span className="cf-logo-word" aria-hidden />
    </span>
  );
}

import Image from "next/image";
import { cn } from "@/lib/utils";

/** Supplied CodeForge identity, sized as one lockup so the mark and wordmark never drift. */
export function LogoLockup({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  return (
    <Image
      src={
        variant === "dark"
          ? "/brand/codeforge-lockup-dark.png"
          : "/brand/codeforge-lockup-light.png"
      }
      alt="CodeForge"
      width={2172}
      height={724}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}

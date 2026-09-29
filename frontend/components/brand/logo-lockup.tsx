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
          ? "/brand/codeforge-lockup-dark-v2.png"
          : "/brand/codeforge-lockup-light-v2.png"
      }
      alt="CodeForge"
      width={1824}
      height={447}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}

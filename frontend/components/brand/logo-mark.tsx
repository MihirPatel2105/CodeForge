import { cn } from "@/lib/utils";

/** A clear C around an F: code shaped by the forge. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0 text-accent", className)}
      role="img"
      aria-label="CodeForge"
    >
      <path
        d="M47.5 16.5a22 22 0 1 0 0 31"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M27 22v20m0-20h15M27 32h12"
        fill="none"
        stroke="var(--fg)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

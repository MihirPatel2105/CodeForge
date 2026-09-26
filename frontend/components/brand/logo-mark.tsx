import { cn } from "@/lib/utils";

/** Five agent stages above the return path for review and test feedback. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0 text-accent", className)}
      role="img"
      aria-label="CodeForge"
    >
      <path d="M11 16h39" fill="none" stroke="var(--fg)" strokeWidth="3.5" strokeLinecap="round" />
      {[11, 20, 29, 38, 47].map((x) => <circle key={x} cx={x} cy="16" r="3.4" fill="currentColor" />)}
      <path d="m51 10 5 6-5 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 29v9c0 9-6 15-15 15H25C16 53 10 47 10 38v-5" fill="none" stroke="var(--fg)" strokeWidth="5" strokeLinecap="round" />
      <path d="m6 39 4-6 4 6" fill="none" stroke="var(--fg)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

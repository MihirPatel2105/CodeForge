import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The signed-in user's initials, linking to their profile.
 *
 * Monochrome like the rest of the chrome: this interface spends colour on run state —
 * working, passed, failed, the loop — and an avatar tinted for decoration would be the
 * one coloured thing on screen that means nothing.
 */
export function UserAvatar({
  initials,
  name,
  className,
}: {
  initials: string;
  name: string;
  className?: string;
}) {
  return (
    <Link
      href="/profile"
      aria-label={`Profile — ${name}`}
      title={name}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-border-strong bg-surface-2",
        "font-mono text-[12px] font-[700] tracking-[0.04em] text-fg transition-colors hover:border-fg",
        className,
      )}
    >
      {initials}
    </Link>
  );
}

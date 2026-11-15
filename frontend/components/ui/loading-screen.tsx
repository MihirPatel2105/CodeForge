import { LogoAssemble } from "@/components/brand/logo-assemble";
import { cn } from "@/lib/utils";

export function LoadingScreen({
  label,
  message = "Getting things ready…",
  className,
}: {
  label: string;
  message?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-atomic="true"
      className={cn("flex min-h-[55vh] items-center justify-center px-4 py-12 text-fg", className)}
    >
      <div className="flex max-w-full items-center gap-4">
        {/* The slab mark assembling on a loop; still, and finished, with reduced motion. */}
        <LogoAssemble isLooping size={48} className="shrink-0" />
        <p className="text-[20px] font-normal leading-snug tracking-[-0.025em] sm:text-[28px]">
          {message}
        </p>
      </div>
    </div>
  );
}

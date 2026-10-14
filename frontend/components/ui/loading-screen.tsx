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
        <span aria-hidden="true" className="relative size-12 shrink-0">
          <span className="absolute inset-0 rounded-full border-y-[1.5px] border-current opacity-30" />
          <span className="absolute inset-0 rounded-full border-y-[1.5px] border-current motion-safe:animate-spin" />
        </span>
        <p className="text-[20px] font-normal leading-snug tracking-[-0.025em] sm:text-[28px]">
          {message}
        </p>
      </div>
    </div>
  );
}

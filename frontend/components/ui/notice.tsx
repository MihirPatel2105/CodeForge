import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  error: { icon: CircleAlert, surface: "border-danger-bd bg-danger-soft/40", accent: "bg-danger-soft text-danger" },
  warning: { icon: TriangleAlert, surface: "border-warn-bd bg-warn-soft/40", accent: "bg-warn-soft text-warn" },
  info: { icon: Info, surface: "border-accent-bd bg-accent-soft/40", accent: "bg-accent-soft text-accent" },
};

export function Notice({
  variant = "error", compact = false, title, children, className, ...props
}: Omit<ComponentProps<"div">, "title"> & {
  variant?: keyof typeof variants;
  compact?: boolean;
  title?: ReactNode;
}) {
  const { icon: Icon, surface, accent } = variants[variant];
  return (
    <div role={variant === "error" ? "alert" : "status"} aria-atomic="true"
      className={cn("flex min-w-0 items-start gap-3 rounded-2xl border px-4 py-3 text-[13px] leading-5 text-fg", surface, compact && "gap-2 rounded-lg border-0 bg-transparent p-0 text-xs", className)} {...props}>
      <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", accent, compact && "size-4 rounded-none bg-transparent")}>
        <Icon className={compact ? "size-3.5" : "size-4"} />
      </span>
      <div className={cn("min-w-0 flex-1 break-words pt-0.5", compact && "pt-0")}>
        {title && <p className="mb-1 font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

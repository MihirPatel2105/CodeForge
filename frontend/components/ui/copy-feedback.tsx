import { Check, Copy } from "lucide-react";

export function CopyFeedback({ copied, label, iconClassName = "h-3.5 w-3.5" }: {
  copied: boolean;
  label: string;
  iconClassName?: string;
}) {
  const transition = "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transform-none motion-reduce:transition-none";

  return (
    <span className="inline-grid items-center" aria-hidden="true">
      <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${transition} ${copied ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100"}`}>
        <Copy className={iconClassName} />{label}
      </span>
      <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${transition} ${copied ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
        <Check className={`${iconClassName} text-ok`} />Copied
      </span>
    </span>
  );
}

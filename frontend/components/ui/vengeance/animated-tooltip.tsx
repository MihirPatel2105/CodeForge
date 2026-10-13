"use client";

// Adapted from Vengeance UI. MIT license: docs/vendor/vengeance-ui.md.
import { useId, useState } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { Info } from "lucide-react";

export function AnimatedTooltip({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  return (
    <Tooltip.Provider delay={200}>
      <Tooltip.Root open={open} onOpenChange={setOpen} triggerId={triggerId}>
        <Tooltip.Trigger id={triggerId} className="vui-help" aria-label={`About ${label}`} closeOnClick={false}
          aria-describedby={open ? `${triggerId}-description` : undefined}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
          onClick={() => setOpen(true)}>
          <Info size={14} aria-hidden />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" sideOffset={8} collisionPadding={16}>
            <Tooltip.Popup id={`${triggerId}-description`} role="tooltip" className="vui-tooltip">{content}<Tooltip.Arrow className="fill-fg" /></Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

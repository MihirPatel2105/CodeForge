"use client";

// Adapted from Vengeance UI. MIT license: docs/vendor/vengeance-ui.md.
import { useId, useRef, useState } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { Info } from "lucide-react";

export function AnimatedTooltip({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  const focused = useRef(false);
  const triggerId = useId();
  return (
    <Tooltip.Provider delay={200}>
      <Tooltip.Root open={open} triggerId={triggerId}
        onOpenChange={(next, details) => {
          // A tap that follows mouse input makes Base UI request a hover-style close right
          // after the tap opened the tooltip. While the trigger holds focus only Escape
          // closes it; moving focus away closes it through onBlur.
          if (!next && focused.current && details.reason !== "escape-key") return;
          setOpen(next);
        }}>
        <Tooltip.Trigger id={triggerId} className="vui-help" aria-label={`About ${label}`} closeOnClick={false}
          aria-describedby={open ? `${triggerId}-description` : undefined}
          onFocus={() => { focused.current = true; setOpen(true); }}
          onBlur={() => { focused.current = false; setOpen(false); }}
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

"use client";

import { useEffect, useRef, useState } from "react";
import CodeSlots from "@/components/ui/react-bits/code-slots";

// Same boxes as the sign-up email-code step: full width, 56px tall, hairline border, ink digits.
const SLOT_GAP = 9;
const SLOT_HEIGHT = 56;
const MIN_SLOT = 32;
const MAX_SLOT = 80;

/** Keep the existing form submission flow; the slots only handle entering the code. */
export function VerificationCode({ id, value, onChange, disabled = false, autoFocus = false, invalid = false, describedBy }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(MAX_SLOT);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setSize(Math.max(MIN_SLOT, Math.min(MAX_SLOT, Math.floor((entry.contentRect.width - 5 * SLOT_GAP) / 6)))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={container} className="cf-verification-code mt-2 w-full font-mono">
    <CodeSlots id={id} value={value} onChange={onChange} disabled={disabled} autoFocus={autoFocus}
      describedBy={describedBy} status={invalid ? "error" : "idle"} slotSize={size} slotHeight={SLOT_HEIGHT} gap={SLOT_GAP} radius={8}
      accentColor="transparent" inkColor="var(--fg)" slotColor="var(--surface)" digitColor="var(--fg)" dangerColor="var(--danger)"
      borderColor="var(--border-strong)" bounce={0.12} />
  </div>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import CodeSlots from "@/components/ui/react-bits/code-slots";

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
  const [size, setSize] = useState(30);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setSize(Math.max(24, Math.min(44, Math.floor((entry.contentRect.width - 20) / 6)))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={container} className="cf-verification-code mt-2 w-full max-w-xs">
    <CodeSlots id={id} value={value} onChange={onChange} disabled={disabled} autoFocus={autoFocus}
      describedBy={describedBy} status={invalid ? "error" : "idle"} slotSize={size} gap={4} radius={10}
      accentColor="var(--accent)" inkColor="var(--fg)" slotColor="var(--surface-2)" digitColor="var(--surface)" dangerColor="var(--danger)" bounce={0.12} />
  </div>;
}

import type { ReactNode } from "react";
import "./run-disclosure.css";

export function RunDisclosure({ open, children }: { open: boolean; children: ReactNode }) {
  return <div className="cf-run-disclosure" data-open={open} aria-hidden={!open} inert={!open}>
    <div className="cf-run-disclosure-content">{children}</div>
  </div>;
}

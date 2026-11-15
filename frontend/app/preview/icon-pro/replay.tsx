"use client";

import { useState } from "react";
import { LogoAssemble } from "@/components/brand/logo-assemble";

/** The one-shot assemble with a replay button: remounting restarts the CSS animation. */
export function AssembleReplay() {
  const [run, setRun] = useState(0);
  return (
    <div className="ip-replay">
      <LogoAssemble key={run} size={168} label="CodeForge" />
      <button type="button" onClick={() => setRun((n) => n + 1)}>Replay</button>
    </div>
  );
}

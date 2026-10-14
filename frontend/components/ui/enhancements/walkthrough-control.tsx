"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WalkthroughControl({ playing, finished, disabled, onClick }: { playing: boolean; finished: boolean; disabled: boolean; onClick: () => void }) {
  const label = finished ? "Replay" : playing ? "Pause" : "Play";
  const Icon = finished ? RotateCcw : playing ? Pause : Play;
  return <div className="cf-playback-control">
    <Button type="button" variant="ghost" disabled={disabled} onClick={onClick} aria-label={`${label} walkthrough`} className="cf-playback-button">
      <span className="cf-playback-icon"><Icon size={15} aria-hidden /></span><span>{label}</span>
    </Button>
  </div>;
}

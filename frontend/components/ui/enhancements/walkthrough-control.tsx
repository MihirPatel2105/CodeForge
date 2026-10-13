"use client";

// Adapted from Skiper UI 3's expanding playback control. See docs/vendor/skiper-ui.md.
import { motion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function WalkthroughControl({ playing, finished, disabled, onClick }: { playing: boolean; finished: boolean; disabled: boolean; onClick: () => void }) {
  const reduced = useMotionPreference();
  const label = finished ? "Replay" : playing ? "Pause" : "Play";
  const Icon = finished ? RotateCcw : playing ? Pause : Play;
  return <motion.div className="cf-playback-control" initial={false} animate={{ width: finished ? 108 : playing ? 124 : 100 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}>
    <Button type="button" variant="ghost" disabled={disabled} onClick={onClick} aria-label={`${label} walkthrough`} className="cf-playback-button">
      <span className="cf-playback-icon"><Icon size={15} aria-hidden /></span><span>{label}</span>
      {playing && !finished && <span className="cf-playback-bars" aria-hidden><i /><i /><i /></span>}
    </Button>
  </motion.div>;
}

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { LogoLockup } from "@/components/brand/logo-lockup";
import { HorizonCanvas } from "@/components/marketing/launch-hero/horizon-canvas";
import { HorizonStage } from "@/components/marketing/launch-hero/horizon-stage";
import "@/components/marketing/launch-hero/launch-hero.css";
import "./auth-horizon.css";

/** Same timeline as the landing, tightened: the horizon first, then the words. */
const ENTRANCE = { eyebrow: 500, headline: 700, steps: 1000, stepsStep: 90 };
const delay = (ms: number) => ({ "--lh-delay": `${ms}ms` }) as CSSProperties;

/** The dark half of the auth split: the landing's sunlit horizon carried into sign-in. */
export function AuthHorizonPanel({ headline, steps }: { headline: string; steps: readonly string[] }) {
  return (
    <aside className="lh-hero ah-panel" aria-label="About CodeForge">
      <HorizonCanvas />
      <Link href="/" aria-label="CodeForge home" className="ah-logo">
        <LogoLockup variant="dark" className="h-9 w-auto" />
      </Link>
      <div className="ah-copy">
        <p className="lh-eyebrow lh-rise" style={delay(ENTRANCE.eyebrow)}>Five agents · One sandbox</p>
        {/* A tagline, not a heading: the page's h1 is the form title. */}
        <p className="ah-headline font-display lh-rise-far" style={delay(ENTRANCE.headline)}>{headline}</p>
        <ol className="ah-steps">
          {/* Keyed by position, like the headline: when sign in swaps to sign up, the words change in
              place instead of the rows unmounting and replaying their one-second entrance. */}
          {steps.map((step, index) => (
            <li key={index} className="lh-rise" style={delay(ENTRANCE.steps + index * ENTRANCE.stepsStep)}>
              <span>{String(index + 1).padStart(2, "0")}</span>{step}
            </li>
          ))}
        </ol>
      </div>
      <HorizonStage />
    </aside>
  );
}

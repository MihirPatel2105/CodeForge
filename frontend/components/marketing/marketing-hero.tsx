import type { ReactNode } from "react";
import { HeroLightRays } from "./hero-light-rays";
import "./marketing-pages.css";

/** The landing atmosphere with each page's own content and reading layout. */
export function MarketingHero({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section id="overview" className={`mk-hero lp-hero-dark ${className}`}>
      <HeroLightRays />
      {children}
      <div className="mk-hero-fade" aria-hidden="true" />
    </section>
  );
}

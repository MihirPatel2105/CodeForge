import type { ReactNode } from "react";
import "./marketing-pages.css";

/** Opening band of an editorial page: a cream hero with each page's own content (DESIGN.md hero-band-cream). */
export function MarketingHero({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section id="overview" className={`mk-hero ${className}`}>
      {children}
    </section>
  );
}

import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./marketing-actions";
import "./editorial-landing.css";
import "./editorial-marketing.css";

/**
 * Shell for the marketing pages (how it works, about, FAQ, contact, legal) in the same language as
 * the home page below its hero: docs/design/ANTHROPIC_DESIGN.md. Header and footer are the shared ones.
 */
export function EditorialPage({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`el-page el-subpage ${className}`}>
      <a className="lp-skip" href="#page-content">Skip to content</a>
      <SiteHeader />
      {/* main spans the full width: it is the sheet the footer reveals from under. */}
      <main id="page-content" className="em-main"><div className="el-body">{children}</div></main>
      <SiteFooter />
    </div>
  );
}

/** A page's opening: a small sans label, a large serif title, one muted paragraph and optional actions. */
export function PageHead({ label, title, lede, actions, aside, centered = false }: {
  label: string;
  title: ReactNode;
  lede: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  centered?: boolean;
}) {
  return (
    <header id="overview" className={`em-head${aside ? " em-head-split" : ""}${centered ? " em-head-centered" : ""}`}>
      <div>
        <p className="em-label">{label}</p>
        <h1>{title}</h1>
        <p className="em-lede">{lede}</p>
        {actions && <div className="em-actions">{actions}</div>}
      </div>
      {aside && <div className="em-aside">{aside}</div>}
    </header>
  );
}

/** A sticky serif heading on the left with the section's content on the right. */
export function SplitSection({ id, title, lede, children, extra }: {
  id?: string;
  title: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className="el-section el-split" id={id} aria-labelledby={headingId}>
      <div className="el-split-head">
        <h2 id={headingId}>{title}</h2>
        {lede && <p>{lede}</p>}
        {extra}
      </div>
      <div>{children}</div>
    </section>
  );
}

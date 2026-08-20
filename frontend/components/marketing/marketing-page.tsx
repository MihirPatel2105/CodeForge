import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/marketing-actions";

/** Shared chrome for the standalone marketing pages (about, how it works, FAQ), so
 * they cannot drift from each other or from the landing page. */
export function MarketingPage({
  eyebrow,
  title,
  lede,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  /** Optional artwork for the space beside the title. Hidden below `lg`, where the
   * column would be too narrow to be worth the vertical cost on a phone. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader />

      <header className="cf-grid border-b border-rule">
        <div className="mx-auto grid w-full gap-x-16 px-6 pt-14 pb-12 md:px-10 md:pt-16 lg:grid-cols-[1fr_auto] lg:px-14">
          <div>
            <span className="font-mono text-[11px] font-[600] uppercase tracking-[0.16em] text-fg-faint">
              [ {eyebrow} ]
            </span>
            <h1 className="font-display mt-8 max-w-[22ch] text-[29px] font-[600] leading-[1.2] tracking-[-0.045em] text-fg sm:text-[34px] md:text-[38px]">
              {title}
            </h1>
            {lede && (
              <p className="mt-6 max-w-[62ch] text-[16.5px] leading-[1.65] text-fg-muted">{lede}</p>
            )}
          </div>
          {aside && <div className="hidden self-center lg:block">{aside}</div>}
        </div>
      </header>

      <main className="mx-auto w-full px-6 py-14 md:px-10 md:py-16 lg:px-14">{children}</main>

      <SiteFooter />
    </div>
  );
}

/** A numbered section, matching the landing page's `[01]` margin notation.
 *
 * `wide` drops the reading measure. Running prose keeps it — a line of text past about
 * 75 characters is genuinely harder to read, so the empty space beside a paragraph is
 * doing a job. Structured content (lists, tables, rows) has no such limit, and capping
 * it just wastes half the screen. */
export function Section({
  index,
  heading,
  wide = false,
  children,
}: {
  index: string;
  heading: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-14 gap-y-5 border-t border-rule py-10 first:border-t-0 first:pt-0 lg:grid-cols-[11rem_1fr]">
      <div className="flex items-baseline gap-3 lg:flex-col lg:gap-2">
        <span className="font-mono text-[12px] font-[600] text-fg">[{index}]</span>
        <span className="font-mono text-[11px] font-[600] uppercase tracking-[0.14em] text-fg-faint">
          {heading}
        </span>
      </div>
      <div className={wide ? undefined : "max-w-[74ch]"}>{children}</div>
    </section>
  );
}

/** Two paragraphs set side by side. Fills the width of a section without stretching
 * either column past a readable measure — the alternative to one long ragged line. */
export function Columns({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-14 gap-y-5 md:grid-cols-2">{children}</div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { AgentNetwork } from "./agent-network";
import "./preview.css";

export const metadata: Metadata = {
  title: "Agent network preview · CodeForge",
  robots: { index: false, follow: false },
};

export default function AgentNetworkPreview() {
  return (
    <main className="network-preview">
      <header className="network-header">
        <Link href="/" className="network-wordmark">CodeForge</Link>
        <span className="network-preview-tag">Design study / 01</span>
        <Link href="/" target="_blank" rel="noopener noreferrer">Compare homepage ↗</Link>
      </header>
      <section className="network-hero" aria-labelledby="network-heading">
        <div className="network-copy">
          <p className="network-eyebrow"><span /> An idea. Five agents. A working API.</p>
          <h1 id="network-heading">Your idea.<br />Built together.</h1>
          <p className="network-intro">A plan becomes code. Code becomes a tested API. Follow the handoffs between the five specialists that make it happen.</p>
          <div className="network-actions">
            <Link href="/signup">Start building <span aria-hidden="true">↗</span></Link>
            <Link href="/how-it-works">See how it works ↗</Link>
          </div>
          <p className="network-caption">You approve the plan. The agents do the work.</p>
        </div>
        <AgentNetwork />
      </section>
      <footer className="network-footer"><span>01 — A connected team</span><p>Every handoff has a purpose.<br />Every result is yours to inspect.</p><span>Interactive hero concept</span></footer>
    </main>
  );
}

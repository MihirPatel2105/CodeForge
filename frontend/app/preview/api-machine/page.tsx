import type { Metadata } from "next";
import Link from "next/link";
import { ApiMachine } from "./api-machine";
import "./machine.css";

export const metadata: Metadata = {
  title: "API assembly machine · CodeForge preview",
  robots: { index: false, follow: false },
};

export default function ApiMachinePreview() {
  return (
    <main className="api-machine-preview">
      <header className="machine-header">
        <Link href="/" className="machine-wordmark">CodeForge<span> / LAB</span></Link>
        <span>DESIGN STUDY 02</span>
        <Link href="/" target="_blank" rel="noopener noreferrer">Current homepage ↗</Link>
      </header>
      <section className="machine-hero" aria-labelledby="machine-title">
        <div className="machine-heading">
          <div><p className="machine-eyebrow"><i /> FROM IDEA TO EXECUTION</p><h1 id="machine-title">An API.<br /><span>Piece by piece.</span></h1></div>
          <div className="machine-intro"><p>Your idea goes in. A working API comes together.<br />Watch the parts find their place.</p><Link href="/signup">Start building <span aria-hidden="true">↗</span></Link></div>
        </div>
        <ApiMachine />
      </section>
      <footer className="machine-footer"><span>BUILT WITH INTENT. TESTED BEFORE HANDOFF.</span><span>Concept animation / example API</span></footer>
    </main>
  );
}

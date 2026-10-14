import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/marketing-actions";
import "@/components/marketing/premium-landing.css";

export const metadata: Metadata = { title: "Credits · CodeForge", description: "Credits for interface components used in CodeForge." };

export default function CreditsPage() {
  return <div className="cf-premium cf-premium-marketing">
    <SiteHeader />
    <main className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-32">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Credits</h1>
      <p className="mt-5 text-fg-muted">CodeForge uses selected interface interactions adapted from these libraries.</p>
      <ul className="mt-8 space-y-6">
        <li><a href="https://skiper-ui.com/" className="font-semibold underline underline-offset-4">Skiper UI</a><p className="mt-2 text-sm text-fg-muted">Adapted arrow, playback, carousel, and scroll-mask interactions.</p></li>
        <li><a href="https://www.vengenceui.com/" className="font-semibold underline underline-offset-4">Vengeance UI</a><p className="mt-2 text-sm text-fg-muted">Selected animated interface components. Copyright and MIT license notices are retained with the source.</p></li>
      </ul>
    </main>
    <SiteFooter />
  </div>;
}

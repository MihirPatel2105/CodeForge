import { Hanken_Grotesk, JetBrains_Mono, Newsreader } from "next/font/google";

// next/font downloads every family at build time and serves it from this origin,
// so the CSP's font-src 'self' holds and no visitor request reaches a font CDN.
// All three faces are SIL OFL. The roles follow an editorial pattern: serif for what
// we say, sans for what you do, mono for what the machine produced.

/** Interface, labels, eyebrows and captions. */
export const brandSans = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-brand-sans",
});

/** Headlines and reading text. The optical-size axis sharpens contrast as type grows. */
export const brandSerif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-brand-serif",
});

/** Code, run ids, logs and other technical data. */
export const brandMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-brand-mono",
});

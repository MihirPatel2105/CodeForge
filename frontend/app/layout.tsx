import type { Metadata } from "next";
import { MotionProvider } from "@/components/layout/motion-provider";
import { PageMotion } from "@/components/layout/page-motion";
import "./globals.css";
import "./premium-system.css";

// Nonces must be generated for each response rather than cached in static HTML.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CodeForge",
  description: "A prompt turns into a running, tested API — watch the agents work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased">
        {/* Light only. A dark theme's black levels are unreliable on an unknown
            projector, so the product ships the one appearance it can vouch for. */}
        <MotionProvider><PageMotion>{children}</PageMotion></MotionProvider>
      </body>
    </html>
  );
}

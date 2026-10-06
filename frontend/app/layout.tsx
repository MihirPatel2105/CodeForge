import { headers } from "next/headers";
import { ThemeProvider } from "@/components/layout/theme-provider";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html suppressHydrationWarning lang="en" data-scroll-behavior="smooth">
      <body className="antialiased">
        <ThemeProvider nonce={nonce}><MotionProvider><PageMotion>{children}</PageMotion></MotionProvider></ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">
        {/* Light only. A dark theme's black levels are unreliable on an unknown
            projector, so the product ships the one appearance it can vouch for. */}
        {children}
      </body>
    </html>
  );
}

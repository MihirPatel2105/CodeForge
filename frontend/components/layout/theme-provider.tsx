"use client";

import { ThemeProvider as Provider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return <Provider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange storageKey="codeforge-theme" nonce={nonce}>{children}</Provider>;
}

"use client";

import { ThemeProvider as Provider } from "next-themes";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const pathname = usePathname();
  const isAgentDashboard = /^\/runs\/[^/]+\/?$/.test(pathname) || /^\/demo\/[^/]+\/?$/.test(pathname);
  return <Provider forcedTheme={isAgentDashboard ? undefined : "light"} attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange storageKey="codeforge-theme" nonce={nonce}>{children}</Provider>;
}

"use client";

import { ThemeProvider as Provider } from "next-themes";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const pathname = usePathname();
  // Signed-in workspace: projects, project pages, every run page (workspace, use, try, publish),
  // recorded demos and a run's Agent City (?run=) follow the theme. Marketing and auth pages stay light.
  const isWorkspace = /^\/(projects|runs)(\/|$)/.test(pathname) || /^\/demo\/[^/]+\/?$/.test(pathname)
    || /^\/playground\/agent-city\/?$/.test(pathname);
  return <Provider forcedTheme={isWorkspace ? undefined : "light"} attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange storageKey="codeforge-theme" nonce={nonce}>{children}</Provider>;
}

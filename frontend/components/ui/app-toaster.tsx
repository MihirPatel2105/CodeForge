"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"}
    position="bottom-right" closeButton visibleToasts={3} offset={24} mobileOffset={16}
    className="cf-toaster" toastOptions={{
      duration: 4000,
      style: { background: "var(--surface)", color: "var(--fg)", borderColor: "var(--border)", borderRadius: 16, fontFamily: "var(--font-ui)" },
    }} />;
}

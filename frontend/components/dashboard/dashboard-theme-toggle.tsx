"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};
export function DashboardThemeToggle() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";
  return <Button variant="outline" disabled={!mounted} aria-pressed={dark} aria-label="Dark mode for agent dashboard" onClick={() => setTheme(dark ? "light" : "dark")} className="h-9 gap-2 rounded-lg text-xs">
    {dark ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
    {dark ? "Light mode" : "Dark mode"}
  </Button>;
}

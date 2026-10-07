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
  const toggleTheme = (button: HTMLButtonElement) => {
    const nextTheme = dark ? "light" : "dark";
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(nextTheme);
      return;
    }

    const root = document.documentElement;
    const bounds = button.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.style.setProperty("--cf-theme-x", `${x}px`);
    root.style.setProperty("--cf-theme-y", `${y}px`);
    root.style.setProperty("--cf-theme-radius", `${radius}px`);
    root.dataset.themeSwitching = "true";
    const transition = document.startViewTransition(() => new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (root.classList.contains("dark") === (nextTheme === "dark")) {
          observer.disconnect();
          window.clearTimeout(timeout);
          resolve();
        }
      });
      observer.observe(root, { attributes: true, attributeFilter: ["class"] });
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 1000);
      setTheme(nextTheme);
    }));
    void transition.finished.finally(() => {
      delete root.dataset.themeSwitching;
      root.style.removeProperty("--cf-theme-x");
      root.style.removeProperty("--cf-theme-y");
      root.style.removeProperty("--cf-theme-radius");
    });
  };

  return <Button variant="outline" disabled={!mounted} aria-pressed={dark} aria-label="Dark mode for agent dashboard" onClick={(event) => toggleTheme(event.currentTarget)} className="h-9 gap-2 rounded-lg text-xs">
    {dark ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
    {dark ? "Light mode" : "Dark mode"}
  </Button>;
}

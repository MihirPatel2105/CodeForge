"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const subscribe = () => () => {};
export function AppearanceControl() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { theme, setTheme } = useTheme();
  return <section className="my-6 rounded-xl border border-border bg-surface p-6" aria-labelledby="appearance-title">
    <h2 id="appearance-title" className="text-xl font-semibold tracking-tight">Appearance</h2>
    <p className="mt-2 text-sm text-fg-muted">Choose a theme for this browser. System follows your device.</p>
    <div role="group" aria-label="Colour theme" className="mt-5 flex flex-wrap gap-2">
      {[{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Monitor }].map(({ value, label, icon: Icon }) => <button key={value} type="button" disabled={!mounted} aria-pressed={mounted && theme === value} onClick={() => setTheme(value)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-fg hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Icon size={16} aria-hidden />{label}</button>)}
    </div>
  </section>;
}

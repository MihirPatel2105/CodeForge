"use client";

// Interaction adaptations: Vengeance UI Spotlight Navbar / Highlight Grid / Stats Counter
// and Skiper UI Theme Toggle Buttons. Sources and terms: docs/vendor/.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { animate, LayoutGroup, motion } from "motion/react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useMotionPreference } from "@/lib/use-motion-preference";

const sections = [
  { id: "sign-in-methods", label: "Sign-in methods" },
  { id: "appearance", label: "Appearance" },
  { id: "sessions", label: "Sessions and devices" },
  { id: "account", label: "Account" },
];

export function SettingsNavigation() {
  const [active, setActive] = useState("sign-in-methods");
  const reduced = useMotionPreference();
  useEffect(() => {
    const update = () => {
      const current = sections.filter(({ id }) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 160).at(-1);
      setActive(current?.id ?? sections[0].id);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("hashchange", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("hashchange", update); };
  }, []);
  return <LayoutGroup><nav aria-label="Settings sections" className="cf-settings-nav flex flex-wrap gap-2">
    {sections.map(({ id, label }) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined}
      onClick={() => setActive(id)} className="relative isolate inline-flex min-h-10 items-center rounded-3xl border border-border px-4 text-[13px] font-[600] text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:text-fg">
      {active === id && <motion.span layoutId="settings-spotlight" aria-hidden className="absolute inset-0 -z-10 rounded-lg bg-surface-2" transition={{ duration: reduced ? 0 : 0.2 }} />}
      {label}
    </a>)}
  </nav></LayoutGroup>;
}

export function SecurityHighlightList({ children }: { children: ReactNode }) {
  const [bounds, setBounds] = useState<{ top: number; height: number } | null>(null);
  const reduced = useMotionPreference();
  const highlight = (target: HTMLElement, list: HTMLElement) => {
    const row = target.closest("li");
    if (!row) return;
    const rect = row.getBoundingClientRect();
    setBounds({ top: rect.top - list.getBoundingClientRect().top, height: rect.height });
  };
  return <div className="relative isolate overflow-hidden">
    {bounds && <motion.div aria-hidden className="pointer-events-none absolute inset-x-0 -z-10 bg-surface-2" initial={false}
      animate={{ top: bounds.top, height: bounds.height }} transition={{ duration: reduced ? 0 : 0.16 }} />}
    <ul className="divide-y divide-rule" onPointerLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setBounds(null); }}
      onPointerMove={(event) => highlight(event.target as HTMLElement, event.currentTarget)}
      onFocusCapture={(event) => highlight(event.target as HTMLElement, event.currentTarget)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setBounds(null); }}>
      {children}
    </ul>
  </div>;
}

const subscribe = () => () => {};
export function AppearanceSettings() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { theme, setTheme } = useTheme();
  const reduced = useMotionPreference();
  return <div className="mt-4 rounded-3xl border border-border bg-surface px-6 py-5">
    <p className="text-[13px] text-fg-muted">Choose a theme for your account pages and run dashboards, or follow your device’s appearance.</p>
    <div role="group" aria-label="Color theme" className="mt-4 flex flex-wrap gap-2">
      {([{ value: "light", label: "Light", Icon: Sun }, { value: "dark", label: "Dark", Icon: Moon }, { value: "system", label: "System", Icon: Monitor }]).map(({ value, label, Icon }) => <button key={value} type="button" disabled={!mounted} aria-pressed={mounted && theme === value} onClick={() => setTheme(value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-[13px] font-semibold aria-pressed:border-border-strong aria-pressed:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <motion.span initial={false} animate={{ rotate: mounted && theme === value ? 0 : -20, scale: mounted && theme === value ? 1 : 0.85 }} transition={{ duration: reduced ? 0 : 0.2 }}><Icon size={17} aria-hidden /></motion.span>{label}
      </button>)}
    </div>
  </div>;
}

export function ProfileCounter({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useMotionPreference();
  useEffect(() => {
    const node = ref.current;
    const number = Number(value.replace(/%$/, ""));
    if (!node) return;
    node.textContent = value;
    if (!/^\d+%?$/.test(value) || reduced) return;
    const suffix = value.endsWith("%") ? "%" : "";
    const animation = animate(0, number, { duration: 0.65, ease: "easeOut", onUpdate: (latest) => { node.textContent = `${Math.round(latest)}${suffix}`; } });
    return () => animation.stop();
  }, [value, reduced]);
  return <span className="tabular-nums"><span className="sr-only">{value}</span><span ref={ref} aria-hidden>{value}</span></span>;
}

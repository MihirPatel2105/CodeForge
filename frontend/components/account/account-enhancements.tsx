"use client";

// Interaction adaptations: Vengeance UI Spotlight Navbar / Highlight Grid / Stats Counter.
// Sources and terms: docs/vendor/vengeance-ui.md.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, LayoutGroup, motion } from "motion/react";
import { scrollToSection } from "@/components/layout/app-scroll";
import { useMotionPreference } from "@/lib/use-motion-preference";

const sections = [
  { id: "sign-in-methods", label: "Sign-in methods" },
  { id: "sessions", label: "Sessions and devices" },
  { id: "account", label: "Account" },
];

export function SettingsNavigation() {
  const [active, setActive] = useState("sign-in-methods");
  const pendingSection = useRef<string | null>(null);
  const reduced = useMotionPreference();
  useEffect(() => {
    const update = () => {
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const pending = pendingSection.current;
      if (pending) {
        const top = document.getElementById(pending)?.getBoundingClientRect().top;
        if (top == null || (top > 104 && !(atBottom && pending === sections.at(-1)!.id))) return;
        pendingSection.current = null;
        setActive(pending);
        return;
      }
      if (atBottom && window.scrollY > 0) { setActive(sections.at(-1)!.id); return; }
      const current = sections.filter(({ id }) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 104).at(-1);
      setActive(current?.id ?? sections[0].id);
    };
    const interrupt = () => { pendingSection.current = null; };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("hashchange", update);
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("hashchange", update); window.removeEventListener("wheel", interrupt); window.removeEventListener("touchstart", interrupt); };
  }, []);
  return <LayoutGroup><nav aria-label="Settings sections" className="cf-settings-nav flex flex-wrap gap-2">
    {sections.map(({ id, label }) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined}
      onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        pendingSection.current = id;
        setActive(id);
        window.history.replaceState(null, "", `#${id}`);
        scrollToSection(target, reduced);
      }} className="relative isolate inline-flex min-h-10 items-center rounded-3xl border border-border px-4 text-[13px] font-[600] text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:text-fg">
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

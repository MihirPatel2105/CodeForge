"use client";

import { useEffect, useState } from "react";
import { motion, useScroll } from "motion/react";

const sections = [
  ["overview", "Overview"], ["how", "Agents"], ["repair-loop", "Repair loop"],
  ["control", "Your control"], ["questions", "FAQ"], ["start-building", "Start building"],
] as const;

export function LandingScrollNav() {
  const { scrollYProgress } = useScroll();
  const [active, setActive] = useState<string>("overview");
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { rootMargin: "-15% 0px -60% 0px", threshold: 0 });
    for (const [id] of sections) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);
  return <>
    <motion.div className="lp-reading-progress" style={{ scaleX: scrollYProgress }} aria-hidden />
    <nav className="lp-scroll-nav" aria-label="Landing page sections">
      {sections.map(([id, label]) => <a key={id} href={`#${id}`} aria-label={label} aria-current={active === id ? "location" : undefined}><span aria-hidden /><span className="lp-scroll-label">{label}</span></a>)}
    </nav>
  </>;
}

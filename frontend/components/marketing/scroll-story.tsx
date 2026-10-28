"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { ArrowDown, ArrowRight, Check, CheckCheck, Code2, FileCode2, Folder, ShieldCheck } from "lucide-react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { DEMO_RUNS } from "@/lib/demo-runs";
import "./scroll-story.css";

const STATIC_QUERY = "(max-width: 800px), (max-height: 760px), (prefers-reduced-motion: reduce)";
function subscribeLayout(callback: () => void) {
  const media = window.matchMedia(STATIC_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const getStaticLayout = () => window.matchMedia(STATIC_QUERY).matches;
const getServerLayout = () => false;
const demo = DEMO_RUNS[0];
const files = Object.keys(demo.finalFiles);
const codeLines = demo.finalFiles["main.py"].trimEnd().split("\n");
const routes = [
  ["POST", "/books", "Add a book"],
  ["GET", "/books", "Browse the collection"],
  ["GET", "/books/{id}", "Find one book"],
  ["PATCH", "/books/{id}", "Update its details"],
  ["DELETE", "/books/{id}", "Remove a book"],
];
const chapters = [
  { label: "Describe", title: ["Start with", "a sentence."], detail: "An idea for a personal library. A few fields. What it should do. That’s enough to begin.", note: "Your idea, in your own words." },
  { label: "Plan", title: ["See the plan.", "Make it yours."], detail: "The PM defines the requirements. The Architect maps the API. You approve both before the build moves on.", note: "Two checkpoints. You stay in control." },
  { label: "Build", title: ["The details", "make the difference."], detail: "The Coder writes the application. The Reviewer spots a missing response model and sends it back for a fix.", note: "Feedback becomes a better next draft." },
  { label: "Verify", title: ["Built.", "Checked. Yours."], detail: "The Tester writes the checks. The Sandbox runs them. Inspect the result, explore the code, and take it with you.", note: "Actual results. An outcome you can inspect." },
];

function CodeLine({ line }: { line: string }) {
  return <>{line.split(/(response_model=BookOut|"[^"]*"|\b(?:from|import|async|def|return)\b)/g).map((part, index) => <span key={index} className={part === "response_model=BookOut" ? "cf-story-code-fix" : part.startsWith('"') ? "cf-story-code-string" : /^(from|import|async|def|return)$/.test(part) ? "cf-story-code-keyword" : undefined}>{part}</span>)}</>;
}

function ProjectArtifact({ index }: { index: number }) {
  if (index === 0) return <div className="cf-story-request">
    <div className="cf-story-request-icon"><Code2 size={26} strokeWidth={1.3} aria-hidden /></div>
    <p className="cf-story-artifact-label">The brief</p>
    <p className="cf-story-request-text">I want an API to manage a personal library of <strong>books</strong> — title, author, ISBN, genre, and whether I’ve read it.</p>
    <div className="cf-story-request-footer"><span>One prompt. A place to start.</span><span className="cf-story-send"><ArrowRight size={20} aria-hidden /></span></div>
  </div>;
  if (index === 1) return <div className="cf-story-blueprint">
    <div className="cf-story-entity"><div><span className="cf-story-artifact-label">Data model</span><h4>Book</h4></div><span className="cf-story-entity-mark"><Folder size={22} strokeWidth={1.3} aria-hidden /></span></div>
    <div className="cf-story-fields">{["title", "author", "ISBN", "genre", "read"].map(field => <span key={field}>{field}</span>)}</div>
    <div className="cf-story-routes" aria-label="Planned library routes">{routes.map(([method, path, description]) => <div key={`${method}-${path}`}><code data-method={method}>{method}</code><span>{path}</span><small>{description}</small></div>)}</div>
    <div className="cf-story-approval"><ShieldCheck size={17} aria-hidden /><span>Requirements + architecture</span><strong>For your approval</strong></div>
  </div>;
  if (index === 2) return <div className="cf-story-code-workspace">
    <div className="cf-story-file-tree"><span>Files</span>{files.map(file => <div key={file} data-selected={file === "main.py"}><FileCode2 size={13} aria-hidden /><span>{file}</span></div>)}</div>
    <div className="cf-story-source"><div className="cf-story-source-tab"><FileCode2 size={13} aria-hidden />main.py<span>Repaired excerpt</span></div><pre aria-label="Generated update route with a response model"><code>{codeLines.map((line, index) => <span className="cf-story-code-line" key={index}><span className="cf-story-line-number" aria-hidden>{index + 1}</span><span><CodeLine line={line} /></span></span>)}</code></pre></div>
    <div className="cf-story-review"><span className="cf-story-review-icon"><ShieldCheck size={18} aria-hidden /></span><div><strong>One review. One meaningful fix.</strong><p>Missing response model → <code>BookOut</code> added.</p></div><Check size={17} aria-hidden /></div>
  </div>;
  return <div className="cf-story-result">
    <div className="cf-story-result-seal"><CheckCheck size={30} strokeWidth={1.4} aria-hidden /></div>
    <p className="cf-story-artifact-label">Library demo · sandbox result</p>
    <div className="cf-story-result-number"><strong>{demo.tests}<span>/{demo.tests}</span></strong><span>tests passed</span></div>
    <div className="cf-story-deliverables">{["Application files", "Review feedback", "Test output"].map(item => <div key={item}><Check size={14} aria-hidden /><span>{item}</span></div>)}</div>
    <p className="cf-story-result-note">Example result. Live runs report their own outcome.</p>
  </div>;
}

function StoryScene({ index, progress, staticLayout, active }: { index: number; progress: MotionValue<number>; staticLayout: boolean; active: boolean }) {
  const start = index / 4;
  const end = (index + 1) / 4;
  const opacity = useTransform(progress, [Math.max(0, start - 0.035), start + 0.035, end - 0.035, Math.min(1, end + 0.035)], [index === 0 ? 1 : 0, 1, 1, index === 3 ? 1 : 0]);
  const y = useTransform(progress, [Math.max(0, start - 0.035), start + 0.035, end - 0.035, Math.min(1, end + 0.035)], [index === 0 ? 0 : 26, 0, 0, index === 3 ? 0 : -26]);
  const scale = useTransform(progress, [0, 0.12, 0.7, 0.9, 1], [0.97, 1, 1, 1.015, 1.015]);
  const chapter = chapters[index];
  return <motion.article className="cf-story-scene" data-chapter={index} aria-hidden={!staticLayout && !active} style={staticLayout ? undefined : { opacity, y }}>
    <div className="cf-story-copy"><span className="cf-story-chapter-label">{chapter.label}</span><h3>{chapter.title[0]}<br /><span>{chapter.title[1]}</span></h3><p className="cf-story-description">{chapter.detail}</p><p className="cf-story-copy-note"><span aria-hidden />{chapter.note}</p></div>
    <motion.div className="cf-story-object" style={staticLayout ? undefined : { scale }}><div className="cf-story-mobile-project" aria-hidden><Code2 size={14} />Library API<span>Example build</span></div><ProjectArtifact index={index} /></motion.div>
  </motion.article>;
}

function ChapterButton({ index, progress, active, onClick }: { index: number; progress: MotionValue<number>; active: boolean; onClick: () => void }) {
  const fill = useTransform(progress, [index / 4, (index + 1) / 4], [0, 1]);
  const chapter = chapters[index];
  return <button type="button" aria-label={`0${index + 1} ${chapter.label}`} aria-current={active ? "step" : undefined} onClick={onClick}><span className="cf-story-nav-track"><motion.span style={{ scaleX: fill }} /></span><span className="cf-story-nav-number">0{index + 1}</span>{chapter.label}</button>;
}

export function ScrollStory({ startHref = "/signup" }: { startHref?: string }) {
  const root = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();
  const staticLayout = useSyncExternalStore(subscribeLayout, getStaticLayout, getServerLayout);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const { scrollYProgress } = useScroll({ target: root, offset: ["start start", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 0.12, 0.7, 0.9, 1], [0.97, 1, 1, 1.015, 1.015]);
  useMotionValueEvent(scrollYProgress, "change", value => {
    const next = Math.max(0, Math.min(3, Math.floor(value * 4)));
    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
    }
  });

  function goToChapter(index: number) {
    const element = root.current;
    if (!element || staticLayout) return;
    const distance = element.offsetHeight - window.innerHeight;
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top + distance * ((index + 0.4) / 4), behavior: "instant" });
  }

  return <section id="build-story" className="cf-scroll-story" ref={root} aria-labelledby="cf-story-title" data-reduced={reduced} data-static={staticLayout}>
    <div className="cf-story-sticky">
      <header className="cf-story-heading"><h2 id="cf-story-title">One idea. All the way through.</h2><span>A Library API, from thought to test.</span></header>
      <div className="cf-story-stage">
        <motion.div className="cf-story-device" style={staticLayout ? undefined : { scale }} aria-hidden><div className="cf-story-device-header"><span className="cf-story-device-logo"><Code2 size={16} strokeWidth={1.4} /></span><strong>Library API</strong><span>Example build</span></div><div className="cf-story-device-screen" /></motion.div>
        {chapters.map((chapter, index) => <div className="cf-story-layer" key={chapter.label} data-active={active === index}><StoryScene index={index} progress={scrollYProgress} staticLayout={staticLayout} active={active === index} /></div>)}
      </div>
      <footer className="cf-story-bottom"><nav aria-label="Walkthrough chapters">{chapters.map((chapter, index) => <ChapterButton key={chapter.label} index={index} progress={scrollYProgress} active={active === index} onClick={() => goToChapter(index)} />)}</nav><div className="cf-story-actions"><Link href="/demo/library" className="cf-story-cta">Inspect the Library demo<span><ArrowRight size={16} aria-hidden /></span></Link><ButtonLink href={startHref} className="cf-story-start">{startHref === "/projects" ? "Start a project" : "Build your first API"}<ArrowRight size={15} aria-hidden /></ButtonLink></div><span className="cf-story-scroll-hint"><ArrowDown size={12} aria-hidden />More ideas below. Then meet the agents.</span></footer>
    </div>
  </section>;
}

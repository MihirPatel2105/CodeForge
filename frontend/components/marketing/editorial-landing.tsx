"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowDown } from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { followLandingSection } from "./landing-navigation";
import { LaunchHeader } from "./launch-hero/launch-header";
import { LaunchHero } from "./launch-hero/launch-hero";
import { SiteFooter } from "./marketing-actions";
import { ProductFilm } from "./product-film";
import { ClosingSection, ExamplesSection, LoopSection, QuestionsSection, StagesSection, StepsSection, useReveal } from "./editorial-landing-sections";
import "./premium-landing.css";
import "./landing-showcase.css";
import "./ostack-landing.css";
import "./editorial-landing.css";

const HERO_ID = "overview";
const TOOLS = ["Python", "FastAPI", "MongoDB", "LangGraph", "Docker", "pytest"];
/** Sections fade in as they scroll into view, which needs JavaScript; without it, show them as they are. */
const NO_SCRIPT_REVEAL = "<style>.el-body [style*=opacity]{opacity:1!important;transform:none!important}</style>";

/**
 * The landing page in the Anthropic-style language of docs/design/ANTHROPIC_DESIGN.md. The header
 * and hero are the live ones, unchanged; everything below them is the editorial set.
 */
export function EditorialLanding() {
  const user = useCurrentUser();
  const reveal = useReveal();
  const reducedMotion = useMotionPreference();
  return (
    <div className="cf-premium cf-ostack el-page">
      {/* A constant style string, no user input. */}
      <noscript dangerouslySetInnerHTML={{ __html: NO_SCRIPT_REVEAL }} />
      <a className="lp-skip" href="#landing-content">Skip to content</a>
      <LaunchHeader heroId={HERO_ID} entrance />
      <main id="landing-content">
        <LaunchHero id={HERO_ID} />
        <div className="el-body">
          <motion.p {...reveal} className="el-statement">
            <strong>One sentence in. A tested API out.</strong> Five AI agents plan, build, review and test it in a
            real sandbox, and you approve the plan before a single line of code is written.
          </motion.p>

          <motion.figure {...reveal} className="el-product el-film" aria-label="CodeForge product film">
            {/* No autoplay: it has music, and loading 16 MB only on demand keeps the page light. */}
            <ProductFilm />
            <figcaption className="el-film-caption">
              <span>CodeForge in 95 seconds: one prompt, five agents, a tested API.</span>
              <Link href="#build-story" className="el-film-follow" onClick={(event) => followLandingSection(event, reducedMotion)} aria-label="Follow the Library build">
                Follow the build, step by step<ArrowDown size={15} aria-hidden />
              </Link>
            </figcaption>
          </motion.figure>

          <p className="el-tools"><span>Built on</span>{TOOLS.map(tool => <span key={tool}>{tool}</span>)}</p>

          <StagesSection />
          <StepsSection />
          <LoopSection />
          <ExamplesSection />
          <QuestionsSection />
          <ClosingSection href={user ? "/projects" : "/signup"} label={user ? "Start a project" : "Build your first API"} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

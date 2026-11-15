import type { CSSProperties } from "react";
import { HorizonCanvas } from "./horizon-canvas";
import { HorizonStage } from "./horizon-stage";
import "./launch-hero.css";

const contents = [
  { href: "#how", label: "Meet the team" },
  { href: "#build-story", label: "The build, step by step" },
  { href: "#repair-loop", label: "The repair loop" },
  { href: "#example-apis", label: "Example APIs" },
  { href: "#questions", label: "Questions" },
];

/** Entrance timeline, in ms from first paint (measured from the reference page). */
const ENTRANCE = { title: 1300, titleStep: 140, eyebrow: 1600, contents: 1900, contentsStep: 80 };

const delay = (ms: number) => ({ "--lh-delay": `${ms}ms` }) as CSSProperties;

/** Opening section. The run is the image: a sunlit horizon with the five agents standing on it. */
export function LaunchHero({ id }: { id: string }) {
  return (
    <section id={id} className="lh-hero" aria-labelledby="launch-title">
      <HorizonCanvas />
      <p className="lh-eyebrow lh-rise" style={delay(ENTRANCE.eyebrow)}>
        Five agents <i aria-hidden>·</i> Two checkpoints <i aria-hidden>·</i> One sandbox
      </p>
      <h1 id="launch-title" className="lh-title">
        <span className="lh-rise-far" style={delay(ENTRANCE.title)}>From an idea</span>{" "}
        <span className="lh-rise-far" style={delay(ENTRANCE.title + ENTRANCE.titleStep)}>to a tested API</span>
      </h1>

      <HorizonStage />

      <nav aria-label="On this page" className="lh-contents">
        <ol className="lh-toc">
          {contents.map((item, index) => (
            <li key={item.href} className="lh-rise" style={delay(ENTRANCE.contents + index * ENTRANCE.contentsStep)}>
              <a href={item.href}>
                <span className="lh-toc-number">[{index + 1}]</span>
                <span className="lh-toc-leader" aria-hidden />
                <span className="lh-toc-label">{item.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  );
}

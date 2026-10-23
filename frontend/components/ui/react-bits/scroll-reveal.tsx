"use client";

// React Bits ScrollReveal fade/scrub behavior, using the installed Motion runtime.
// Source and license: docs/vendor/react-bits-product-effects.md.
import { useEffect, useRef, type ComponentProps } from "react";
import { useScroll } from "motion/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function ScrollReveal({ children, className = "", ...props }: Omit<ComponentProps<"h2">, "children"> & { children: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const reduced = useMotionPreference();
  const { scrollYProgress } = useScroll({ target: heading, offset: ["start end", "end end"] });

  useEffect(() => {
    const node = heading.current;
    if (!node || reduced) return;
    const words = node.querySelectorAll<HTMLElement>("[data-reveal-word]");
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    // Upstream defaults: opacity .1, rotation 3deg, blur 4px,
    // .5 scrub span and .05 stagger. Word reveal starts 20% into the heading.
    const paint = (progress: number) => {
      node.style.transform = `rotate(${3 * (1 - clamp(progress))}deg)`;
      const at = clamp((progress - .2) / .8) * (.5 + Math.max(0, words.length - 1) * .05);
      for (let index = 0; index < words.length; index++) {
        const reveal = clamp((at - index * .05) / .5);
        words[index].style.opacity = String(.1 + .9 * reveal);
        words[index].style.filter = reveal < 1 ? `blur(${4 * (1 - reveal)}px)` : "none";
      }
    };
    paint(scrollYProgress.get());
    const unsubscribe = scrollYProgress.on("change", paint);
    return () => {
      unsubscribe();
      node.style.removeProperty("transform");
      for (const word of words) {
        word.style.removeProperty("opacity");
        word.style.removeProperty("filter");
      }
    };
  }, [children, reduced, scrollYProgress]);

  return <h2 {...props} ref={heading} className={`cf-scroll-reveal ${className}`} aria-label={children.replace(/\s+/g, " ")} style={{ ...props.style, transformOrigin: "0% 50%" }}>
    <span aria-hidden="true">{children.split(/(\s+)/).map((word, index) => word.trim() ? <span key={index} data-reveal-word style={{ display: "inline-block" }}>{word}</span> : word.includes("\n") ? <br key={index} /> : word)}</span>
  </h2>;
}

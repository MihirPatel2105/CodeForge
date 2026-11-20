"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Play } from "lucide-react";
import { useMotionPreference } from "@/lib/use-motion-preference";

const SRC = "/video/codeforge-product-film.mp4";
const POSTER = "/video/codeforge-product-film-poster.jpg";
const LENGTH = "1:35";
/** Below this share of the film on screen, a playing film pauses: the viewer has scrolled on. */
const PAUSE_BELOW_VISIBLE = 0.35;

/**
 * The product film on the landing page. It starts as a smaller rounded panel and grows to the full
 * column as it scrolls towards the middle of the screen (a transform, so nothing below it moves),
 * and pauses itself when the viewer scrolls away. Reduced motion shows it full size, still.
 */
export function ProductFilm() {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const reducedMotion = useMotionPreference();
  const { scrollYProgress } = useScroll({ target: frame, offset: ["start 0.95", "start 0.15"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.72, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [28, 18]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < PAUSE_BELOW_VISIBLE && !element.paused) element.pause();
      },
      { threshold: [0, PAUSE_BELOW_VISIBLE, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const play = () => {
    setStarted(true);
    void video.current?.play().catch(() => {
      // Autoplay rules or a decode error: the native controls are showing, so the viewer can retry.
    });
  };

  return (
    <div ref={frame} className="el-film-frame">
      <motion.div
        className="el-film-stage"
        style={reducedMotion ? { borderRadius: 18 } : { scale, borderRadius: radius }}
      >
        <video
          ref={video}
          className="el-film-video"
          src={SRC}
          poster={POSTER}
          controls={started}
          playsInline
          preload="metadata"
          width={1920}
          height={1080}
          aria-label="CodeForge product film"
          onPlay={() => setStarted(true)}
        />
        {!started && (
          <button type="button" className="el-film-play" onClick={play}>
            <Play size={16} fill="currentColor" aria-hidden />
            Play the film
            <span>{LENGTH}</span>
          </button>
        )}
      </motion.div>
    </div>
  );
}

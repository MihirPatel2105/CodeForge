"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAnimate } from "motion/react";
import { AuthEntryShell } from "./auth-entry-shell";
import { motionEase } from "@/lib/motion-tokens";
import { useMotionPreference } from "@/lib/use-motion-preference";

const AuthTransitionContext = createContext<{
  navigate: (href: string) => void;
  setLabel: (label: string) => void;
} | null>(null);

export const useAuthTransition = () => useContext(AuthTransitionContext);

/** Keep the story mounted while Next replaces the sign-in or registration form. */
export function AuthEntryTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname !== "/login" && pathname !== "/signup" && pathname !== "/login/passkey") return children;
  return <AuthTransitionFrame pathname={pathname}>{children}</AuthTransitionFrame>;
}

function AuthTransitionFrame({ pathname, children }: { pathname: string; children: ReactNode }) {
  const router = useRouter();
  const reducedMotion = useMotionPreference();
  const [scope, animate] = useAnimate<HTMLElement>();
  const animateRef = useRef(animate);
  const [label, setLabel] = useState(pathname === "/signup" ? "Create account" : pathname === "/login/passkey" ? "Passkey sign in" : "Sign in");
  const previousPath = useRef(pathname);
  const previousHeight = useRef<number | null>(null);
  const navigating = useRef(false);
  const generation = useRef(0);
  const playback = useRef<{ complete: () => void; stop: () => void } | null>(null);

  useLayoutEffect(() => { animateRef.current = animate; }, [animate]);

  useLayoutEffect(() => {
    const card = scope.current;
    if (!card) return;
    const currentGeneration = ++generation.current;
    const switching = previousPath.current !== pathname;
    previousPath.current = pathname;
    navigating.current = false;
    const compact = window.matchMedia("(max-width: 800px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const direction = pathname !== "/login" ? 1 : -1;
    const style = getComputedStyle(card);
    const content = card.querySelector<HTMLElement>(".pa-form-content");
    const contentHeight = (content?.offsetHeight ?? 0) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const height = Math.max(contentHeight, parseFloat(style.minHeight) || 0);
    // Keep perspective identical at both endpoints; interpolating it to `none`
    // makes Motion shrink the perspective distance and magnify the whole card.
    const end = !switching ? "translateY(0px)" : compact
      ? "translateX(0px)"
      : "perspective(1200px) rotateY(0deg) translateX(0px)";
    const start = !switching ? "translateY(12px)" : compact
      ? `translateX(${direction * 12}px)`
      : `perspective(1200px) rotateY(${direction * 8}deg) translateX(${direction * 14}px)`;
    if (switching && !reduce && previousHeight.current !== null) card.style.height = `${previousHeight.current}px`;
    card.inert = switching && !reduce;
    const controls = animateRef.current(card, {
      opacity: reduce ? 1 : [0, 1],
      transform: reduce ? "none" : [start, end],
      ...(switching && previousHeight.current !== null ? { height: [previousHeight.current, height] } : {}),
    }, { duration: reduce ? 0 : 0.42, ease: motionEase });
    playback.current = controls;
    void (async () => {
      await controls;
      if (generation.current !== currentGeneration) return;
      card.inert = false;
      previousHeight.current = height;
      card.style.removeProperty("height");
      card.style.removeProperty("transform");
      if (!card.contains(document.activeElement)) {
        card.querySelector<HTMLElement>("input:not([type=hidden]), button:not([disabled])")?.focus({ preventScroll: true });
      }
    })();
    return () => controls.stop();
  }, [pathname, scope]);

  useLayoutEffect(() => {
    if (reducedMotion) playback.current?.complete();
  }, [reducedMotion]);

  async function navigate(href: string) {
    const card = scope.current;
    if (!card || navigating.current || href === pathname) return;
    navigating.current = true;
    const currentGeneration = generation.current;
    const direction = href !== "/login" ? 1 : -1;
    const compact = window.matchMedia("(max-width: 800px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    router.prefetch(href);
    previousHeight.current = card.offsetHeight;
    playback.current?.stop();
    card.inert = true;
    const neutral = compact ? "translateX(0px)"
      : "perspective(1200px) rotateY(0deg) translateX(0px)";
    const outgoing = compact ? `translateX(${-direction * 12}px)`
      : `perspective(1200px) rotateY(${-direction * 8}deg) translateX(${-direction * 14}px)`;
    const controls = animate(card, {
      opacity: reduce ? 1 : 0,
      transform: reduce ? "none" : [neutral, outgoing],
    }, { duration: reduce ? 0 : 0.18, ease: "easeIn" });
    playback.current = controls;
    await controls;
    if (generation.current === currentGeneration) router.push(href, { scroll: false });
  }

  return <AuthTransitionContext.Provider value={{ navigate, setLabel }}>
    <AuthEntryShell shared label={label} formRef={scope}>{children}</AuthEntryShell>
  </AuthTransitionContext.Provider>;
}

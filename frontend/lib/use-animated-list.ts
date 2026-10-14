"use client";

import { useEffect } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function useAnimatedList<T extends HTMLElement>() {
  const reduced = useMotionPreference();
  const [ref, enable] = useAutoAnimate<T>({ duration: 180, easing: "ease-out" });
  useEffect(() => { enable(!reduced); }, [enable, reduced]);
  // Rebuild from React's current data when motion changes; cancelled exit
  // animations in AutoAnimate can otherwise leave removed DOM nodes behind.
  return { ref, key: reduced ? "still" : "animated" };
}

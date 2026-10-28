export const motionEase = [0.16, 1, 0.3, 1] as const;
export const motionDuration = { fast: 0.16, standard: 0.22, panel: 0.28, considered: 0.48 } as const;
export const motionTransition = { duration: motionDuration.standard, ease: motionEase };
export const motionSpring = { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 };

/** Shared feedback for actions, whether they navigate or submit a form. */
export function controlMotion(reduced: boolean, inactive = false) {
  return {
    whileHover: reduced || inactive ? undefined : { scale: 1.01 },
    whileTap: reduced || inactive ? undefined : { scale: 0.98 },
    animate: reduced || inactive ? { scale: 1 } : undefined,
    transition: reduced ? { duration: 0 } : motionSpring,
  };
}

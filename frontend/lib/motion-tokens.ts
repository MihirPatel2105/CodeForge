export const motionEase = [0.16, 1, 0.3, 1] as const;
export const motionTransition = { duration: 0.28, ease: motionEase };
export const motionSpring = { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 };

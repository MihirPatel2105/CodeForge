import type { CSSProperties } from "react";

/**
 * The horizon's geometry, with nothing drawn on it. The sky canvas (HorizonCanvas) measures the
 * centre of this orbit and the invisible anchor at its top to draw the lit arc, so this must live
 * in the same <section> as the canvas.
 */
export function HorizonStage() {
  return (
    <div className="lh-stage" aria-hidden>
      <span className="lh-orbit">
        <span className="lh-spoke" style={{ "--lh-angle": "0deg" } as CSSProperties}>
          <span className="lh-node lh-anchor"><i /></span>
        </span>
      </span>
    </div>
  );
}

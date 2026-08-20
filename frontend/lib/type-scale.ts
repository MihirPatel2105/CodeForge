/**
 * The dashboard's type scale, from the design handoff. One source of truth so no
 * component invents its own size/weight/tracking combination.
 *
 * Nothing in the timeline goes below 14.5px; nothing anywhere goes below 11px —
 * the floor is set by projector legibility, not aesthetics.
 */

export const typeScale = {
  /** 34px/700/-.03em, mono — headline metrics (result summary). */
  display: "font-mono text-[34px] font-bold tracking-[-0.03em]",
  /** 21px/600/-.02em — the user's prompt in the run header. */
  runPrompt: "text-[21px] font-semibold tracking-[-0.02em]",
  /** 17px/650/-.015em — screen titles. */
  section: "text-[17px] font-[650] tracking-[-0.015em]",
  /** 15.5px/650/-.015em, line-height 1.15 — agent card name. */
  cardTitle: "text-[15.5px] font-[650] tracking-[-0.015em] leading-[1.15]",
  /** 14.5px/450/1.4 — the floor for the timeline feed. */
  timelineBody: "text-[14.5px] font-[450] leading-[1.4]",
  /** 13.5px/450/1.62, mono — code panel body. */
  code: "font-mono text-[13.5px] font-[450] leading-[1.62]",
  /** 13px/1.6, mono — terminal body (distinct line-height from the code panel). */
  terminal: "font-mono text-[13px] font-[450] leading-[1.6]",
  /** 11.5px/700/.05em uppercase — state pills, section eyebrows. */
  label: "text-[11.5px] font-bold tracking-[0.05em] uppercase",
  /** 12px/450, mono — timestamps, model ids. */
  metaMono: "font-mono text-[12px] font-[450]",
} as const;

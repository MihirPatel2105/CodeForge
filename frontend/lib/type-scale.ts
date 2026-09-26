/** Shared dashboard type roles. Code and machine identifiers keep the mono face. */

export const typeScale = {
  /** Headline metrics (result summary). */
  display: "font-display text-[34px] font-bold tracking-[-0.045em]",
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
  /** State pills and compact section labels. */
  label: "text-[12px] font-[650] tracking-[0.01em]",
  /** 12px/450, mono — timestamps, model ids. */
  metaMono: "font-mono text-[12px] font-[450]",
} as const;

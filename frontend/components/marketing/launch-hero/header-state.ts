export type HeaderTone = "hero" | "page";

export interface HeaderState {
  /** The wordmark has retracted into the mark. */
  collapsed: boolean;
  /** The bar has slid out of the way of the reading column. */
  hidden: boolean;
  /** Which surface the bar is drawn against. */
  tone: HeaderTone;
}

export interface ScrollSample {
  scrollY: number;
  /** Position where the scroll direction was last settled. */
  anchorY: number;
  heroBottom: number;
  headerHeight: number;
  wasHidden: boolean;
}

export const COLLAPSE_AFTER_PX = 24;
/** Ignore trackpad jitter: direction only counts after this much travel. */
export const DIRECTION_THRESHOLD_PX = 8;

export const INITIAL_HEADER_STATE: HeaderState = { collapsed: false, hidden: false, tone: "hero" };

export function nextHeaderState(sample: ScrollSample): HeaderState {
  const { scrollY, anchorY, heroBottom, headerHeight, wasHidden } = sample;
  const pastHero = scrollY + headerHeight / 2 >= heroBottom;
  const travelled = scrollY - anchorY;

  let hidden = wasHidden;
  if (!pastHero) hidden = false;
  else if (travelled >= DIRECTION_THRESHOLD_PX) hidden = true;
  else if (travelled <= -DIRECTION_THRESHOLD_PX) hidden = false;

  return {
    collapsed: scrollY > COLLAPSE_AFTER_PX,
    hidden,
    tone: pastHero ? "page" : "hero",
  };
}

export function sameHeaderState(a: HeaderState, b: HeaderState): boolean {
  return a.collapsed === b.collapsed && a.hidden === b.hidden && a.tone === b.tone;
}

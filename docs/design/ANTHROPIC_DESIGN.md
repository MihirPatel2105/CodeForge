# Anthropic-style design reference

A reference for the "Anthropic-style" look used across CodeForge's dashboard and landing page.
It was written from studying anthropic.com and claude.com's public product pages on 2026-11-18
(computed styles and layout, not source files). It records **principles and measurements**, not
assets: CodeForge never uses Anthropic's logo, wordmark, fonts, illustrations or copy. Our
equivalents are listed beside each token.

## 1. Character

Calm, literary, confident. Pages read like a well-set essay that happens to sell software:
generous space, one idea per section, very little decoration. Colour is rare and means
something. Motion is slow and small.

## 2. Colour

| Role | Observed | CodeForge token |
|---|---|---|
| Page (paper) | `#faf9f5` warm off-white | `--surface` / `--bg` |
| Ink | `#141413` near-black, slightly warm | `--fg` |
| Muted text | ink at ~60% | `--fg-muted` |
| Faint text / meta | ink at ~45% | `--fg-faint` |
| Hairline | ink at ~10% | `--ax-hair`, `--rx-hair` (`color-mix(var(--fg) 10%)`) |
| Card on paper | pure white, or a warm grey a shade below paper | `--surface-2` / white |
| Quiet button fill | warm grey (`~#e8e6dc`) | `color-mix(var(--fg) 6%, var(--surface))` |
| Dark band / footer | ink `#141413` with paper text | `--fg` background, `--surface` text |
| Accent | used sparingly, one warm accent for a brand mark | CodeForge keeps its own state colours: ok, warn, danger, loop |

Rules: no gradients behind text, no glows, no tinted cards to mean "important". Colour
appears only for state (passed, failed, waiting) or in imagery.

## 3. Typography

- **Display serif** for page titles, section titles, card titles and large statements.
  Weight 400–500, letter-spacing about -1% (-0.01em), line-height 1.1–1.25.
  Observed: hero statement ~41px/1.25; section heads ~56–70px/1.0–1.1; card titles ~22–26px.
- **Sans** for body, UI, buttons and meta. Body ~16–17px/1.5–1.55. Meta 12–13px.
- **Statement pattern**: a short bold sans lead-in followed by serif text in the same
  paragraph, often in muted ink.
- **Lead-in pattern** in lists: a bold serif phrase, then a regular serif sentence.
- Small uppercase labels are *not* an Anthropic signature; meta is sentence-case in a small sans.
  CodeForge uses small uppercase labels inside its product UI only.

CodeForge fonts: Newsreader (`--font-brand-serif`) for display, Hanken Grotesk for sans,
JetBrains Mono for code.

## 4. Layout and rhythm

- Content max width ~1310px with 80px side margins on desktop; 24px on phones.
- **One page edge (CodeForge rule):** the header and every page share `--page-max` (1310px) and
  `--page-gutter` (`clamp(16px, 5.4vw, 80px)`). Page content starts under the logo and ends under the
  account button. Apply `.cf-page` to a page's full-width container; `tests/e2e/page-edges.spec.ts`
  checks it on every page at 1440, 1920 and 390px. Admin, sign-in and Agent City opt out.
- Section spacing is large: 120–160px between sections on desktop, 72–96px on phones.
- **Centred section head**: a small line illustration, then a large serif title, then one or
  two lines of muted sans. Content follows below, centred or in a grid.
- **Two-column list**: a sticky serif heading on the left (about 40%), a vertical list on the
  right. Each item has a lead-in sentence and a meta row (icon, label, date) under it.
- **Card grid**: three across on desktop, one on phones. Cards are white or warm grey on
  paper, radius 16–20px, padding 32px, no shadow. Inside: a meta row (pill + label + date),
  a title, a short paragraph, then hairline-separated detail rows and a full-width quiet
  button at the bottom.
- **Media**: large, full-bleed or inset images with 8–16px radius.

## 5. Components

- **Buttons**: primary is ink fill with paper text, radius ~8px, height ~40–44px, sans 15–16px.
  Secondary is a quiet warm-grey fill or a 1px hairline outline. Text links carry a light underline.
- **Navigation**: small pill buttons with a hairline outline; logo centred or left.
- **Command pill**: a code snippet in a rounded, slightly darker paper box next to the primary
  button (mono, syntax colour only on the command).
- **Segmented switch**: a warm-grey track with a white thumb, radius ~10px.
- **Accordion rows**: full-width rows separated by hairlines, label left, chevron right.
- **Footer**: a dark ink band; the logo on the left, accordion rows on the right, and the mission
  and legal text small at the bottom.

## 6. Illustration and imagery

Hand-drawn, single-weight line spot illustrations (ink outline with one warm-grey fill)
above centred section heads; editorial collage images on cards. CodeForge draws **its own**
simple line drawings for the same role; Anthropic's illustrations are not reused.

## 7. Motion

Slow fades and small rises (8–16px, 400–600ms, ease-out) as sections enter. No parallax on
text, no bouncing. Everything is disabled under `prefers-reduced-motion`.

## 8. How CodeForge applies this

- Dashboard and account surfaces: `app/account-editorial.css`,
  `components/dashboard/run-editorial.css`, `project-editorial.css`, `projects-editorial.css`.
- Landing page below the hero (live on `/` since 2026-11-18):
  `components/marketing/editorial-landing*.{tsx,css}`. The previous landing (`premium-landing.tsx`)
  is still rendered by `/preview/hero-relief` and `/preview/constellation`.
- Marketing pages (How it works, About, FAQ, Contact, Privacy, Terms): `components/marketing/editorial-marketing.{tsx,css}`
  (shared shell, page head, split sections) plus `legal-page.tsx`, built on the same `el-*` styles.
- The hero (`components/marketing/launch-hero/`) already follows the model-launch page layout
  and is left unchanged.

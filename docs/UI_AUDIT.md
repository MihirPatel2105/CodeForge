# CodeForge UI audit

<!-- Hallmark · pre-emit critique: P4 H4 E4 S5 R5 V4 -->

Date: 2026-09-30. Method: source inspection using Hallmark's audit rules, interpreted
for the modern-minimal genre. This is not a browser, contrast, or full 58-gate pass.
Severity describes design impact, not a security vulnerability. No runtime files
were changed. The shared specification was recorded after the audit; existing
pages are not penalized for missing newly introduced system stamps.

## Pre-flight findings

- Next.js 15.5.26, React 19.1, Tailwind v4, shadcn/Base UI; see
  `frontend/package.json:15–43`.
- Existing system sans and monospace stacks; semantic blue/green/amber/red/purple
  tokens and a 12px radius; see `frontend/app/globals.css:100–164`.
- CSS motion and `tw-animate-css`; no separate motion framework in package.json.
- Product already uses a left-aligned prompt/output hero, workflow walkthrough,
  and outcome evidence; see `frontend/app/page.tsx:24–40`.

## Critical

### 1. Mid-render token improvisation

Where: `frontend/app/globals.css:295–313` and
`frontend/components/dashboard/agent-card.tsx:75–87`.

Decorative backgrounds and state shadows introduce literal indigo/purple values
outside the shared palette. The workflow already assigns distinct meanings to
blue active work and purple repair loops, so independent colors complicate that
discipline.

Fix: replace decoration with existing surfaces, or define a small set of semantic
effect tokens derived from the established palette. Preserve meaningful loop
highlights and terminal treatment.

## Major

### 2. Card-in-card framing

Where: `frontend/components/marketing/hero-output.tsx:76–101`.

The output preview has an outer border/shadow/radius and a second bordered,
shadowed code panel. The content regions are legitimate, but the duplicate framing
makes the demonstration heavier than its contents.

Fix: keep the file header and code area while simplifying one containment layer.
Do not remove functional code, test, or terminal boundaries elsewhere.

### 3. Small essential controls and labels

Where: `frontend/components/dashboard/evidence-tabs.tsx:48`,
`frontend/components/dashboard/code-panel.tsx:203–216`, and
`frontend/components/dashboard/timeline-panel.tsx:102`.

Evidence navigation and timeline actions use 10px uppercase text. The live screen
must explain a run clearly during a demonstration; these controls risk becoming
hard to read even when their layout is technically compact.

Fix: promote essential control text to 12–14px, preserve adequate hit areas, and
reserve small monospace text for secondary metadata. Confirm the actual result
in a browser before treating this as a measured accessibility failure.

## Minor

### 4. Transition scope is broader than necessary

Where: `frontend/components/ui/switch.tsx:19`,
`frontend/components/ui/tabs.tsx:61`, and `frontend/components/ui/badge.tsx:8`.

`transition-all` can animate focus borders and ring shadows along with ordinary
interaction styling. These primitives do have focus treatments; the issue is
immediacy and precision, not absent keyboard focus.

Fix: explicitly transition the intended properties and keep focus styling instant.

### 5. Surface radius hierarchy needs an explicit rule

Where: `frontend/components/marketing/hero-output.tsx:76–90` and
`frontend/components/marketing/hero-demo.tsx:57–76`.

The hero mixes `rounded-3xl`, `rounded-2xl`, and `rounded-lg` without a documented
relationship. Not every different radius is wrong: pills, inherited inner corners,
and intentional line tabs are valid exceptions.

Fix: adopt the documented base/panel/pill roles in `DESIGN.md`, then visually review
affected nested surfaces before adjusting classes.

## What should stay

- The prompt/output hero already explains the product and avoids the centered
  hero plus three identical feature-card pattern.
- Preserve the inspectable code, timeline, approval checkpoints, and repair loop.
- Preserve semantic status text, the dark terminal, system fonts, and Lucide icons.
- White surfaces and one sans UI family are appropriate for modern-minimal;
  do not flag them using Hallmark's editorial-only rules.
- Stateful agent rails convey real workflow information. Do not automatically
  remove them as decorative side-stripe cards.
- A functional file header or evidence tab is not fake browser/IDE chrome.

## Next implementation order

1. Tokenize effect colors and simplify the homepage output framing.
2. Improve evidence-control typography and standardize surface radius roles.
3. Refine transition scope and verify keyboard/reduced-motion behavior.
4. Check marketing, auth/settings, projects, Live Run, and admin routes in a browser.

## Unverified checks

Responsive overflow, CTA fit at 1280×800, actual color contrast, keyboard tab
behavior, touch interaction, and loading/error layouts need rendered verification.
No invented claims or missing states are asserted from a text search alone.

**1 critical · 2 major · 2 minor**

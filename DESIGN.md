# CodeForge design system

Status: user-approved premium direction, extended across page families on 2026-09-30.
The homepage and auth screens are the visual references. Runtime behavior stays authoritative.

## Purpose and direction

CodeForge turns an API request into an inspectable, tested result through five
agents and a sandbox. The interface should make progress, approval checkpoints,
review findings, and repair loops understandable at a glance.

Genre: modern-minimal. Tone: confident, spacious, and calm. Use the approved
homepage and auth pages as the source of truth: bold system typography, white
product stages, cool secondary surfaces, rounded panels, blue primary actions,
and restrained motion. Keep operational density where evidence needs it.

## Source of truth

Runtime tokens live in `frontend/app/globals.css`, including Tailwind v4 aliases.
Reuse those tokens and existing shadcn/Base UI components. Do not introduce a
parallel theme, theme picker, font dependency, or animation framework.
`frontend/app/premium-system.css` unifies page families and consumes the existing tokens.
`docs/UI_BRIEF.md` defines workflow visibility and screen priorities.

## Palette

| Role | Existing token | Value |
| --- | --- | --- |
| Page | `--bg` | `#f7f8fb` |
| Panel | `--surface` | `#ffffff` |
| Secondary panel | `--surface-2` | `#f3f5f9` |
| Text | `--fg` | `#172033` |
| Secondary text | `--fg-muted` | `#526073` |
| Metadata | `--fg-faint` | `#657285` |
| Border | `--border` | `#e2e7ef` |
| Strong border | `--border-strong` | `#cbd4e1` |
| Active work / retrieval | `--accent` | `#2457d6` |
| Success | `--ok` | `#0f7a55` |
| Warning / designed stop | `--warn` | `#9c5605` |
| Failure | `--danger` | `#b4231f` |
| Repair loop only | `--loop` | `#6d28d9` |

Primary actions use accent blue with surface-colored text. Blue also communicates
active work, selection, and focus. Purple belongs to repair-loop paths, entries,
and iteration indicators; never general branding or buttons. Preserve the dark
terminal and designated dark content regions within the light product.
Always pair status color with a readable label or icon.

## Typography and spacing

Keep the existing system sans stack for navigation, headings, and prose. Keep
system monospace for code, timestamps, durations, and technical identifiers.
Use tabular numerals for aligned numeric columns. No decorative serif pairing.

Suggested hierarchy for future polish: body 14–16px; essential labels 12–14px;
panel headings 19–24px; page headings 32–48px. Keep the existing responsive hero
scale where it fits. Tiny technical annotations must not carry essential actions.

Prefer the existing Tailwind spacing scale: 4, 8, 12, 16, 24, 32, 48px. Align
related labels and actions. Give live workflow explanations more room than admin
tables. Density must serve scanning, not reduce demo readability.

## Shape and components

Controls use a 12px base radius; panels use 24px and primary actions use pill shapes. Existing aliases: `sm` approximately 10px; `md` and `lg`
12px; `xl` and `2xl` approximately 16px; full radius for pills and circles.
Use semantic aliases rather than unrelated literal radii. Intentional line tabs
and inherited inner corners are exceptions, not radius defects.

Use one dominant panel boundary. Nested containment is acceptable for genuinely
separate content regions, but avoid duplicate borders and shadows framing the
same code preview. Keep Lucide as the UI icon family; retain the product mark.

## Page families

- Marketing: a generous product stage with bold short headings and inspectable output,
  followed by a workflow explanation, result evidence, and a clear next action.
- Projects/history: aligned lists or tables with project name, outcome, duration,
  iteration count, and direct navigation. Avoid marketing-sized cards for rows.
- Live Run: pipeline first, visible return paths and loop count, timeline,
  approval controls, then code/test/terminal evidence. Preserve agent states.
- Auth/settings: focused forms, consistent labels and validation, clear recovery
  actions, and restrained supporting product context.
- Admin: compact operational tables, filters, pagination, and clear empty/error
  states. Share tokens with the rest of the app.

Pages share the same visual system. Hallmark's theme rotation between unrelated
briefs does not apply across CodeForge routes. Existing routes do not need CSS
stamps merely because this document was added.

## Interaction and motion

Provide visible keyboard focus and appropriate hover, pressed, disabled, loading,
error, and success treatments. Do not invent irrelevant states for static text.
Use explicit transition properties instead of `transition-all` on focusable UI.
Keep focus indicators immediate and respect reduced-motion preferences.

Motion should communicate work, a stage handoff, or a repair loop. Avoid ambient
decoration, entrance effects on every section, and celebratory effects on routine
actions. Preserve keyboard navigation, approval semantics, and existing API flows.

## Copy and evidence

Use specific action labels and safe public error messages. Do not fabricate
performance claims, testimonials, adoption numbers, or test success. Recorded
examples must be distinguishable from live runs. A simulated writing animation
must not imply a fresh sandbox execution.

## Verification for future UI changes

Review rendered pages at 320, 375, 414, and 768px widths and 1280×800 desktop.
Check CTA fit, long names, keyboard navigation, touch targets, reduced motion,
and empty/loading/error/success states. Keep overflow inside code/terminal regions
where necessary. Report browser verification separately from source inspection.

## Reference provenance

- Hallmark: https://github.com/nutlope/hallmark
- Cobalt example: https://www.usehallmark.com/examples/cobalt-01/
- GitHub-inspired specification:
  https://github.com/nexu-io/open-design/blob/main/design-systems/github/DESIGN.md

These are public inspiration references. CodeForge's own tokens and workflow
remain authoritative. No external design source is a substitute for product
requirements or user authorization.

## Implementation verification — 2026-09-30

- Production build, TypeScript, frontend ESLint, and whitespace checks passed.
- Browser reviewed public pages, workspace/project detail, profile/security layouts,
  admin overview, and shared project dialog. Mobile overflow checks sampled 320px
  and 375px; desktop previews used 1280px.
- Completed recorded demo: evidence tab targets resolve, tab clicks work, and
  ArrowRight selects and focuses the next evidence tab.
- Protected-screen visual checks used an isolated temporary frontend with sample
  API responses. Its session shim and API fixtures are not part of this repository.
  Real login, account mutations, SSE execution, and publishing were not exercised.
- Dynamic admin detail pages and live run states compile and inherit the shared
  system; every populated state was not individually browser-verified.

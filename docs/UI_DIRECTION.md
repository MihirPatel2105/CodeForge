# Recommended UI direction for CodeForge

Date: 2026-09-30. Status: researched direction and standalone interactive concept.
This is a design recommendation, not a shipped frontend redesign.

## Decision

Use a light developer workbench, with a prompt-to-result demonstration on the
homepage and a workflow-first Live Run screen. Keep the existing CodeForge logo,
system fonts, semantic state colors, and rounded component language.

The product's distinctive visual moment is the review/test feedback returning to
the Coder. Make that understandable before adding decoration or extra dashboards.
Users should see what is happening, why work returned, and where to inspect proof.

## Skills and their responsibilities

| Skill | Responsibility |
| --- | --- |
| Hallmark | Product-specific composition, token discipline, honest copy, restrained framing |
| UI/UX Pro Max | Readable controls, responsive priorities, focus, progress, and feedback |
| Frontend Design | Concrete design choices tied to API building and agent collaboration |

`DESIGN.md` remains the shared specification. The skills provide guidance; their
automatic theme choices do not override the established product requirements.

Two UI/UX Pro Max system searches returned FAQ-oriented structures and dark
developer palettes. These were rejected as a poor match. Focused searches for
progress and keyboard focus supplied relevant guidance. No generated system output
was persisted as authoritative. Next.js search results referenced a newer framework
version; no version-specific or file-restructuring advice was adopted.

## Reference shortlist

| Reference | What to borrow | Fit for CodeForge |
| --- | --- | --- |
| Hallmark Cobalt / Distil | Visible input/output, API vocabulary, restrained technical hierarchy | Strong homepage inspiration |
| Vercel Geist | Consistent component states, restrained surfaces, clear type roles | Strong component polish reference |
| GitHub Actions visualization | Ordered stages, explicit state, dependencies, access to logs | Strong Live Run interaction reference |
| OpenDesign GitHub-inspired specification | Lists, code organization, status semantics, system typography | Useful existing reference; no OpenDesign app required |

Sources:

- https://www.usehallmark.com/examples/cobalt-01/
- https://vercel.com/geist/introduction
- https://docs.github.com/en/actions/how-tos/monitor-workflows/use-the-visualization-graph
- https://github.com/nexu-io/open-design/blob/main/design-systems/github/DESIGN.md

This recommendation adapts ideas to CodeForge. It does not reproduce an external
brand or adopt the example sites' metrics, testimonials, pricing, or capabilities.

## Homepage composition

1. A concise product statement and short explanation, with a direct next action.
2. One wide demonstration: a plain-English request beside its endpoint output.
3. Existing Library, Inventory, and Support examples; demo data labeled visibly.
4. An ordered agent sequence, with a clear explanation that findings return for repair.
5. Outcome evidence and an appropriate account/project CTA in the eventual product.

The prototype uses local preview navigation for its CTAs. A production implementation
must retain the existing account-aware routing and actual application actions.

## Live Run composition

1. Project/run context and a concise explanation of the current state.
2. Six ordered stages, with text and icons alongside semantic color.
3. A visible return path between Reviewer and Coder during the repair example.
4. Activity and evidence side by side on desktop, stacked on phones.
5. A design checkpoint that exposes planned endpoints before approval.
6. Code, finding, and test output tabs; success evidence appears only when complete.

The current concept demonstrates review repair, architecture approval, and success.
A production pass must also retain requirement approval, test-triggered repair,
cancellation, interruptions, failures, max-loop stops, and connection recovery.
The preview is not proof that those additional states have been redesigned.

## Other routes

- Projects/history: aligned project and run rows, readable outcomes, consistent actions.
- Auth/settings: focused forms with the same type scale, borders, radii, and focus states.
- Admin: compact operational tables and filters, with larger essential action labels.

These route directions are recommendations; the standalone concept contains only
the homepage and Live Run screens.

## Verification performed

- Inspected the existing rendered homepage at `localhost:3001`.
- Viewed the standalone concept in Chrome at 1280×800 and phone size.
- Checked homepage layout at 320, 375, 414, 768, and 1280px widths.
- Checked all three Live Run examples at the same five widths.
- Fixed code-panel overflow and a small stage-label overflow found at narrow widths.
- Verified example switching, screen switching, evidence tabs, arrow-key tab
  navigation, preview approval, and completed test-output navigation.
- Browser console returned no errors during the checked interactions.
- JavaScript syntax check passed. Representative text/token contrast pairs passed
  4.5:1; this does not constitute a complete accessibility audit.

Code overflow is contained in its own scroll area. Reduced-motion rules are present;
OS-level reduced-motion emulation and a full screen-reader audit were not performed.
The sample test counts and code are illustrative data based on existing demo fixtures,
not a fresh sandbox execution. No runtime frontend or backend files were modified.

## Reviewable concept

The durable concept is saved at:

`/Users/tanmaypatel/.codex/visualizations/2026/09/30/01a0f039-c769-7082-9334-5bff4e944a91/codeforge-ui-concept/index.html`

Its sibling files contain the CSS tokens, interaction code, screenshots, and
responsive verification results. The local preview is served at
`http://127.0.0.1:8766/` while the preview server is running.

## Implementation priority

Start with Live Run and its complete state coverage, then the homepage, then apply
the shared component rules across projects, auth/settings, and admin. Verify the
actual routes after implementation. Preserve the existing API, SSE, and approval
contracts throughout the UI work.

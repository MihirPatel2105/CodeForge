# CodeForge Studio — isolated UI preview

Date: 2026-10-14. Direction selected by the user: editorial monochrome,
sharp typography, generous space and subtle motion.

## Review boundary

Entry point: `/preview/redesign`.
A dedicated server on port 3002 runs a separate frontend copy. Existing application routes,
authentication, database, sandbox and agent orchestration are not replaced.
All new UI lives in `frontend/components/redesign-preview` and the catch-all preview route.
The screen selector exposes public, workspace, API tool, account, authentication and
administration designs. This is a navigable frontend prototype, not a backend migration.

The prototype uses fictional records and in-memory state. Creating a project, sending a
sample request, confirming publication, changing a password, adding a passkey and deleting
an account do not call the real backend. Forms state this explicitly. Downloads contain
labelled sample source. Legal screens are layout specimens, not new legal policies.
No real generated source is presented as verified production output.

## Design system

- White canvas, near-black text, neutral surfaces and thin dividers.
- Existing CodeForge logo lockup; no new brand or oversized footer wordmark.
- Large sans-serif editorial headings, monospace evidence, tabular numerical values.
- Public pages use an asymmetric two-column composition. Application pages use one
  consistent workspace shell with compact secondary navigation.
- Controls have explicit hover/focus states. Base UI dialogs manage focus and dismissal.
- Motion is short and purposeful; reduced-motion preferences disable physical animation.
- Mobile navigation is a dialog. Tables and code scroll within bounded regions.
- Settings deliberately excludes Appearance, following the user's removal request.

## Tools and component provenance

| Tool or source | Inspected | Actual use |
| --- | --- | --- |
| shadcn CLI | `info --json`, registry search for sidebar | Existing Base UI Button, Dialog, Input, Textarea, Badge, Switch and Tabs components, composed into the preview |
| Spectrum UI MCP | `search_components` for sidebar and stepper; `get_component` for sidebar-navbar | Workspace grouping/collapsible navigation inspiration. No source was returned or copied; sidebar code is independently authored |
| Motion MCP | Documentation search for layout and reduced motion; official accessibility guide | Existing Motion reveal and control interactions, with explicit reduced-motion fallback |
| 21st.dev | Public catalogue at https://21st.dev | Catalogue research only. Its MCP is not exposed in this session; no paid or gated component source was accessed or copied |
| Skiper UI | https://skiper-ui.com/v1/skiper99 | Reuses CodeForge's attributed AnimatedArrow interaction. Free-source attribution remains in the preview footer and vendor document |
| Vengeance UI | Search Modal and Staggered Grid documentation | Reuses the attributed FAQ accordion; independently adapts search-dialog structure and restrained sequential project entrances |
| Local skills | design-taste-frontend, redesign-existing-projects, shadcn, motion, React best practices | Marketing hierarchy, scoped design isolation, accessible composition and component review |

References:
- https://spectrumhq.in/docs/sidebar-navbar
- https://ui.shadcn.com/docs/components/base/dialog
- https://motion.dev/docs/react-accessibility
- https://www.vengenceui.com/components/search-modal
- https://www.vengenceui.com/components/staggered-grid
- Existing usage terms: `docs/vendor/skiper-ui.md`, `docs/vendor/vengeance-ui.md`.

## Working interactions

Project search, filters, grid/list layout, local project creation, command search,
mobile navigation, sample workflow playback/approval/reset, timeline search and repairs,
file selection and scroll, code wrap/copy, finding-to-line navigation, test evidence tabs,
local GET/POST/DELETE samples, encoded query parameters, JSON validation, response views,
integration snippets, sample downloads, publishing confirmation, account confirmations,
local passkey/device examples, authentication form states and admin search/filtering.

## Before a live replacement

Review the visual direction and flows. Then integrate approved layouts with the existing
session hooks, API client, run history/SSE loading, reviewer findings, sandbox evidence,
readiness checks and account actions. Keep all existing authorization, approval and
execution contracts intact. The preview should never be substituted for real execution.

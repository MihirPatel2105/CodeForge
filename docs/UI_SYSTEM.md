# CodeForge UI consistency

Use the existing monochrome system on marketing, authentication, workspace,
account, admin, and Agent City screens. A new page should compose the shared
components instead of restyling their interaction states locally.

## Actions and fields

| Element | Use | Geometry |
| --- | --- | --- |
| `Button` | Submits, changes state, opens a dialog | Capsule for actions |
| `ButtonLink` | Navigates with the visual weight of an action | Same variants and feedback as `Button` |
| Compact buttons | Icons, filters, small tools, ghost actions | 8px corners; inferred for small/icon/ghost variants |
| `Input`, `Textarea` | Form values | 12px corners |
| Text links | Navigation within prose or quiet chrome | Keep link semantics and visible keyboard focus |

Use `variant="default"` for primary actions, `outline` or `secondary` for supporting
actions, `ghost` for quiet tools, and `destructive` for destructive actions. Use
`shape="compact"` explicitly for a toolbar control whose default size would
otherwise imply an action capsule. Do not override shared radii in page CSS.

Default actions are 44px high; large marketing/authentication actions are 52px.
Dense admin headers and toolbars can use a smaller height appropriate to their
layout. Small controls must retain their existing accessible labels and hit areas.
Keep the same variant, shape, and motion at every size.

Colors come from `app/globals.css`: `--bg`, `--surface`, `--surface-2`, `--fg`,
`--fg-muted`, `--border`, and `--accent`. Use semantic tokens for success, warning,
danger, and the review loop. Avoid page-specific action colors. Approved dark hero
artwork and the contained code editor retain their contrasting palettes.

## Motion and accessibility

`lib/motion-tokens.ts` owns JavaScript motion presets. `controlMotion` is used by
`Button`, `ButtonLink`, and `MotionButton` so navigation and state changes have the
same hover scale (1.01) and press scale (0.98). Disabled controls stay still.
Selection indicators use `motionSpring`.

CSS control tokens live in `app/premium-system.css`. Standard color/focus
transitions use 220ms with `cubic-bezier(.16,1,.3,1)`; quick changes use 160ms and
panel transitions use 280ms. Hero entrances, illustrative sequences, loading, and
replay playback have separate durations because they communicate different things.

Respect `useMotionPreference()` and CSS `prefers-reduced-motion`, including when
the preference changes while a page is open. Keep keyboard focus visible and use
danger focus treatment for destructive or invalid controls. Motion must never be
the only signal of selection, pending work, success, or failure.

## Verification

`frontend/tests/e2e/ui-consistency.spec.ts` checks cross-page action and field
geometry, shared navigation/submit feedback, disabled controls, keyboard focus,
dynamic reduced motion, and matching theme controls in Agent City and the run demo.
It runs in the frontend quality workflow alongside the existing interaction and
page regression suites.

For new UI work, inspect desktop and mobile rendering, light/dark mode where
supported, pending/error states, dialogs, keyboard navigation, and reduced motion.
Run the complete frontend selection in `.github/workflows/quality.yml` before
publishing UI changes.

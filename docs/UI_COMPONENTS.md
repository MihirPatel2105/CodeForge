# Selected CodeForge components

These refinements use the existing Motion and Base UI stack. shadcn primitives
were added in the project's Base Nova style; existing buttons and inputs were
preserved. Motion effects are restrained adaptations of the selected patterns,
not a new theme. Stepper is excluded.

| Pattern | Where to test | Interaction |
| --- | --- | --- |
| Resizable panels | Any run → Execution evidence | Drag the file/code divider or code/console divider; focus a divider and use arrow keys. Mobile keeps stacked files and code. |
| Morphing popover | Execution evidence → Timeline | Open Filter activity, combine search/agent/view filters, then close it. Escape in search clears the query. |
| Dynamic toolbar | Generated code → View options | Toggle Wrap; updated files with archived content also expose Current/Diff. Copy remains directly available. |
| Code tabs | Publish API → Make a request | Switch cURL/Node.js/Python with mouse or arrow keys; copy the selected request. |
| Search Cell | Homepage → Find an example to explore | The hint types once on entry; entering a query filters real recorded demos. |
| Empty states | Projects, Run history, Timeline, Try API saved requests | Search for a nonexistent item, clear filters, or inspect an empty account/list. |
| Context menu | Generated files | Right-click a file or use its ⋯ button to copy path/code or download that file. |
| Preview link card | Homepage → Watch a full run / Explore example links | Hover or focus a link to see a locally stored demo screenshot. |
| Multi-select combobox | Project → Run history → All outcomes | Search and select multiple outcomes; remove chips. Filters persist when loading more runs. |
| Text Morph | Live run → Current state | The heading transitions when the actual stage changes, including approval and completion states. |
| Magnetic CTA | Homepage → Build your first API / Start a project | The main button follows a fine mouse pointer by a few pixels and returns on exit. |

Motion respects reduced-motion preferences. The search hint runs once rather than
looping; magnetic motion is disabled for touch. Link previews use screenshots of
the local recorded demos, with no third-party screenshot calls.

## References

- [shadcn Base UI](https://ui.shadcn.com/docs/components)
- [Motion Primitives](https://motion-primitives.com/)
- [Animate UI](https://animate-ui.com/)
- [ScrollX UI](https://www.scrollxui.dev/)

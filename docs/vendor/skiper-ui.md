# Skiper UI adaptations

Retrieved 2026-10-13 from the official free registry, https://skiper-ui.com/r/{name}.json.

| Source | Documentation | Registry JSON SHA-256 |
| --- | --- | --- |
| skiper99 | https://skiper-ui.com/v1/skiper99 | `0ba050ff9d919198ca229def1534cdb76abbea16888cdf140ac5fc3275c43b51` |
| skiper3 | https://skiper-ui.com/v1/skiper3 | `52f87a78714dc0e95638a8bc67f30f9b64f2958278a37a178521f446d85214b8` |
| skiper48 | https://skiper-ui.com/v1/skiper48 | `97b22bb8e35b3f86cf8376c00a5c30a6ca958d80d296fa914d8835cb64166111` |
| skiper87 | https://skiper-ui.com/v1/skiper87 | `c91a8426d903cb43c7de536ece64b7eba483534fe0aa6939e46fbdce91a56e8c` |

These are focused adaptations, not unmodified installs:

- 99: arrow hover and controlled menu-to-close icon, composed into native links and Base UI dialogs.
- 3: expanding playback control connected to the existing walkthrough's actual playback state.
- 48: swipeable examples with native CSS scroll snapping and accessible arrow/key controls, replacing Swiper and image demos with CodeForge's existing example data. No autoplay.
- 87: scoped CSS scroll-timeline edge masks in the activity timeline and file rail. The code viewport is never masked. Unsupported browsers keep normal scrolling; reduced motion disables masks.

## Usage terms and attribution

Official terms: https://skiper-ui.com/docs/quick-start (License & Usage).
Free to use and modify for personal and commercial projects. Attribution to Skiper UI is required for free components.
Attribution is included in the public site footer and retained in source comments and this document.

Skiper UI credits the scroll-mask technique to Gustav Ekerot and jh3yy:
https://skiper-ui.com/v1/skiper87.

Existing CodeForge Motion, Base UI, Next Link and native scrolling are used; no additional runtime dependencies were installed.

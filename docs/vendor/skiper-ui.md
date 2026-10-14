# Skiper UI adaptations

Retrieved 2026-10-13 from the official free registry, https://skiper-ui.com/r/{name}.json.

| Source | Documentation | Registry JSON SHA-256 |
| --- | --- | --- |
| skiper99 | https://skiper-ui.com/v1/skiper99 | `0ba050ff9d919198ca229def1534cdb76abbea16888cdf140ac5fc3275c43b51` |
| skiper3 | https://skiper-ui.com/v1/skiper3 | `52f87a78714dc0e95638a8bc67f30f9b64f2958278a37a178521f446d85214b8` |
| skiper48 | https://skiper-ui.com/v1/skiper48 | `97b22bb8e35b3f86cf8376c00a5c30a6ca958d80d296fa914d8835cb64166111` |
| skiper87 | https://skiper-ui.com/v1/skiper87 | `c91a8426d903cb43c7de536ece64b7eba483534fe0aa6939e46fbdce91a56e8c` |

## Retired integrations

The integrations recorded above were removed on 2026-10-15. The public Credits
page and footer link were also removed. This file retains the historical source
record; these registry implementations are no longer shipped.

- Arrow and menu controls now render standard Lucide icons directly.
- Walkthrough playback uses a standard Base UI button with plain state labels.
- The example gallery uses native CSS scroll snapping and IntersectionObserver
  to track the visible card; it does not use the downloaded registry component.
- The scroll-timeline edge-mask adaptation was removed. Native scrollbars remain.

Vengeance UI's retained source license notices are in `vengeance-ui.md`.

# Vengeance UI adaptations

Source: https://github.com/Ashutoshx7/VengeanceUI/tree/main/public/r
Retrieved 2026-10-13. Eight selected registry components are adapted in
`frontend/components/ui/vengeance/`. These are focused CodeForge adaptations,
not unmodified registry installs. Existing Motion, Base UI and Next Link replace
Framer Motion, custom modal handling and GSAP. No extra runtime dependency is needed.

- Animated Number: rolling digits; actual accessible value; reduced motion.
- Folder Preview: folder/paper interaction; real project metadata, no invented filenames.
- Agent Bento Grid: responsive agent cards and artifact excerpts using existing example data.
- Generate Button: controlled starting state, native disabled behavior.
- FAQ Accordion: active rail and plus/minus; existing multi-open behavior preserved.
- Line Hover Link: slide underline; Next Link and keyboard focus.
- Animated Tooltip: spring entrance; Base UI positioning, Escape and touch opening.
- Expandable Bento Grid: feature cards opening accessible Base UI dialogs.
- Animated Footer was evaluated and then removed at user request; the original footer links and copyright remain.

Registry JSON SHA-256 at retrieval:

| Component | SHA-256 |
| --- | --- |
| agent-bento-grid | `9a378dd93cb7bdc59ee69fb5c3898fd8f318ae815bb0b4d5f3ab1f795da4e7f1` |
| animated-footer | `ae4eecf9074ba7dd777c52193d1456ebbdb8372f586a1fdf890f8d10958d3224` |
| animated-number | `b0651b98ce8397640d7de59eb156ba5c384772aaf6445556e1950508b87f4a18` |
| animated-tooltip | `046e3561ee25a1b519ca91d75efb462dc0ebf79494d667a8101493ef1cc5d794` |
| expandable-bento-grid | `1f3a8914ada1b67e3acb061b0b07a66710ebf06720a12c4c208619dcf870bb5b` |
| faq-accordion | `860025d09aca4c2f3dedf6f525330bb7841f90c6ab1f7821b8bc9252b11798b0` |
| folder-preview | `7e4aa49c3216b542679731a6ba783e560a9e7f6a7b225c942b2c4391d2ce2128` |
| generate-button | `269c6d3adefa65a58b7d94c7cdd6ae141a70a26cfe92f88d77bbb10c0a57c56e` |
| line-hover-link | `6e1108ddfd1cdc42e9c6165a7f42eac027d34edb00ec4c5f03389b8161d3adfa` |

## License

MIT License

Copyright (c) 2025-2026 Ashutoshx7

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

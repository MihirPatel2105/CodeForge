# Amicro icon interactions

Sources:
- https://github.com/Subhan-code/Amicro--Micro-transitions-/blob/main/src/components/AnimatedButton.tsx
- https://github.com/Subhan-code/Amicro--Micro-transitions-/blob/main/src/data/buttons.tsx

Retrieved 2026-10-20. `frontend/components/ui/action-icon.tsx` adapts the fixed-size
icon morph, spring (stiffness 600, damping 25), and reload rotation. It uses existing
Motion, Lucide, semantic styling, and reduced-motion preferences. No dependency added.

Used for runnable-project downloads, Publish API, Check connection, and publish-page
refresh/retry controls. Checks reflect resolved action states, never demo hover state.
Download confirmation means browser download started, not that a file finished saving.
No request handlers or API contracts changed.

## License

MIT License

Copyright (c) 2026 SYED  SUBHAN UDDIN

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

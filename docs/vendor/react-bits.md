# React Bits Threads

Source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Backgrounds/Threads/Threads.tsx
Demo: https://reactbits.dev/backgrounds/threads
Retrieved: 2026-10-22.

Used as CodeForge's landing hero background in `frontend/components/marketing/threads.tsx`.
The original native WebGL2 renderer has no external dependencies. CodeForge uses grey
colors, a slower speed, a center mask, and lazy loading. Rendering pauses offscreen
and when the document is hidden. Reduced motion disables both time and pointer motion,
including when that preference changes during use. The former constellation remains
available in its existing isolated preview.

## Gradient ASCII hero

Source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Backgrounds/GradientASCII/GradientASCII.tsx
Demo: https://reactbits.dev/backgrounds/gradient-ascii
Retrieved: 2026-10-22.

`gradient-ascii.tsx` retains the native WebGL renderer with a live `paused` setting.
The hero uses the live demo Atmosphere defaults, including its original palette,
decoding entrance, speed, flicker, and wave click effect. Rendering pauses for reduced
motion or the visible Pause background control. The top bar is transparent over the
hero and returns to a light background on scroll. The component already
sleeps offscreen and when the tab is hidden. CSS supplies a dark gradient fallback.
The dark styling and scroll fade apply only to the hero. Threads remains intact.

## Upstream license

MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

The same restriction covers the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the sounds in the sound library. **You may not sell, sublicense, or redistribute the tools or the sounds themselves, or offer the tools or a substantially similar copy of them as a hosted service-whether alone, in a bundle, or as a ported version.**

What you make with the tools is yours to use. You can use exported code, images, videos, and audio files in any personal or commercial application, website, or product, including paid ones. **You may not sell or redistribute the exports on their own, either individually or as the product itself, such as a sound, texture, background, or template pack.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

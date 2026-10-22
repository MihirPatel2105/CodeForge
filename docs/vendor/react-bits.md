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
motion. The user-facing pause control has been removed. The top bar is transparent over the
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


# React Bits Tech Text

Source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/TextAnimations/TechText/TechText.tsx
Demo: https://reactbits.dev/text-animations/tech-text
Retrieved: 2026-10-22. Covered by the upstream license above.

Used in `frontend/components/marketing/tech-text.tsx`, with a footer wrapper in
`footer-tech-text.tsx`. Adaptations fit the existing wordmark footprint, expose
first-paint readiness for a text fallback, and pause rendering in hidden tabs.
The wrapper disables animation for reduced motion. The footer uses the demo’s default Vector preset, including the idle sweep,
letter dragging, click kicks, selection labels, and spring bounce. Only its text,
white color, and maximum font size are customized.

# React Bits profile enhancements

Spotlight source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Components/SpotlightCard/SpotlightCard.tsx
Profile interaction reference: https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Components/ProfileCard/ProfileCard.tsx
Retrieved: 2026-10-22. Covered by the upstream license above.

`profile-spotlight.tsx` vendors Spotlight Card with shared theme tokens supplied by
`profile-premium.tsx`. The identity card is a custom initials-based adaptation of
the Profile Card pointer tilt and glare, using a monochrome surface instead of its
portrait, holographic foil, icon packages, or device-orientation features. Entrances
use local CSS; the existing Motion counter remains. Reduced motion disables tilt,
entrances, and spotlight intensity.

# Settings surfaces and navigation

Line Sidebar reference: https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Components/LineSidebar/LineSidebar.tsx
Retrieved: 2026-10-22. Covered by the upstream license above.

`settings-premium.tsx` reuses the vendored Spotlight Card for settings panels.
Its section rail adapts Line Sidebar's smooth proximity falloff into a restrained
four-pixel shift on the existing native anchor links. It preserves scroll tracking,
keyboard focus, and account controls. Reduced motion disables proximity movement,
panel entrances, and spotlight intensity. Local CSS carries the shared surfaces
into the password, passkey, and authenticator pages.

# React Bits product effects

Retrieved: 2026-10-22.

- Spotlight Card: [source](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Components/SpotlightCard/SpotlightCard.tsx), [demo](https://reactbits.dev/components/spotlight-card).
- Specular Button: [source](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Components/SpecularButton/SpecularButton.tsx), [demo](https://reactbits.dev/components/specular-button).
- Gradual Blur: [source](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Animations/GradualBlur/GradualBlur.tsx), [demo](https://reactbits.dev/animations/gradual-blur).
- Animated List: [source](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Components/AnimatedList/AnimatedList.tsx), [demo](https://reactbits.dev/components/animated-list).
- Stepper: [source](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Components/Stepper/Stepper.tsx), [demo](https://reactbits.dev/components/stepper).
- Blur Text: [source](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/TextAnimations/BlurText/BlurText.tsx), [demo](https://reactbits.dev/text-animations/blur-text).

CodeForge uses focused adaptations of these interaction patterns rather than the full
configurable demo components. Pointer-driven radial light uses existing accent tokens;
buttons retain their existing semantics. Progressive edge blur is limited to 12px and
tracks actual scroll overflow. List entrances retain stable item keys and existing
keyboard navigation; selection and pipeline indicators use the installed Motion runtime.
The headline resolves word by word once on mount. Reduced-motion preferences disable
entrance and movement effects. No additional animation dependencies are required.


## Micro interactions

Retrieved: 2026-10-22. Sources in `src/ts-tailwind/Micro/` of the same upstream repository:

- [Status Mark](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Micro/StatusMark/StatusMark.tsx) — agent card status, using actual pipeline states and existing status labels.
- [Rubber Segment](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Micro/RubberSegment/RubberSegment.tsx) — Pretty / Tree / Raw / Headers selection, with existing button semantics, arrow-key navigation, theme tokens, and drag disabled.
- [Code Slots](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Micro/CodeSlots/CodeSlots.tsx) — login MFA and authenticator settings, with responsive sizing, associated form labels, full-code paste, and existing explicit submission. Recovery-code text entry stays a text field.
- [Thought Line](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Micro/ThoughtLine/ThoughtLine.tsx) — selected agent activity, with recent real timeline messages, summary text, and an expandable activity trace. Only completed stages receive completion marks.
- [Lattice Loader](https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/Micro/LatticeLoader/LatticeLoader.tsx) — currently working agent detail, with elapsed time from the stage's recorded start time; demos use their playback timestamp so pausing also pauses the clock.

The source components are retained under `frontend/components/ui/react-bits/`.
Adaptations replace Hugeicons with the installed Lucide icons, use current Motion derived-value APIs,
share the live reduced-motion preference, disable looping visual effects for reduced motion,
and preserve existing form, selection, and workflow behavior. No new dependencies.

## Auth hero reuse

`auth-atmosphere.tsx` reuses the existing Gradient ASCII renderer behind the shared
account-entry shell. It keeps the landing palette with speed 0.24, no flicker, no
pointer effects, and a dark contrast overlay. The renderer stays mounted between
sign-in, registration, and passkey transitions; reduced motion draws a static frame.
Mobile renders the compact CSS brand header without mounting a WebGL canvas.

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

/** Full-rect triangle pair; the fragment shader does all the work. */
export const HORIZON_VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

/**
 * A planet's limb seen from orbit, with the sun sitting on it. Everything is computed per
 * pixel in CSS-pixel space, so the arc lines up exactly with the DOM labels placed on it.
 */
export const HORIZON_FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uResolution;   // drawing buffer, device px
uniform float uDpr;
uniform float uTime;        // seconds
uniform vec2 uCentre;       // planet centre, CSS px from the canvas's top-left
uniform float uRadius;      // CSS px
uniform float uSun;         // sun's angle on the limb, radians from the top
uniform vec2 uPointer;      // CSS px
uniform float uArc;         // 0..1 entrance of the limb
uniform float uFlare;       // 0..1 entrance of the sun

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
// Value noise around a circle: \`turn\` is 0..1 of a full turn and \`cells\` a whole number,
// so the pattern meets itself where the angle wraps and leaves no seam in the rays.
float ringNoise(float turn, float cells) {
  float x = fract(turn) * cells;
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(vec2(mod(i, cells), cells)), hash(vec2(mod(i + 1.0, cells), cells)), f);
}
float gauss(float x, float width) { return exp(-(x * x) / (width * width)); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;
  // One unit of "optical size": keeps band and flare proportions from phone to desktop.
  float s = clamp(uResolution.x / uDpr / 1440.0, 0.5, 1.5);

  vec2 fromCentre = p - uCentre;
  float d = (length(fromCentre) - uRadius) / s;       // > 0 in the sky, < 0 on the planet
  float angle = atan(fromCentre.x, -fromCentre.y);    // 0 at the top of the limb

  vec2 sun = uCentre + uRadius * vec2(sin(uSun), -cos(uSun));
  vec2 toSun = p - sun;
  float r = length(toSun) / s;
  float near = gauss(angle - uSun, 0.34);              // how close along the limb to the sun

  // Atmosphere: violet-blue scattering above, a white-hot line, ember red beneath.
  float lit = mix(0.42, 1.0, near) * uArc;
  vec3 light = vec3(0.0);
  light += vec3(0.20, 0.16, 1.00) * gauss(d - 15.0, 15.0) * 0.95 * lit;
  light += vec3(0.30, 0.34, 1.00) * exp(-max(d, 0.0) / 70.0) * step(0.0, d) * 0.16 * lit;
  light += vec3(1.00, 0.95, 0.98) * gauss(d - 1.0, 7.5) * 1.15 * lit;
  light += vec3(1.00, 0.36, 0.07) * gauss(d + 8.5, 5.0) * 0.85 * lit;
  light += vec3(0.55, 0.07, 0.02) * gauss(d + 15.0, 7.0) * 0.45 * lit;

  // Sun: a hot core, a wide bloom, and uneven rays that turn slowly.
  float turn = atan(toSun.y, toSun.x) / 6.2831853 + 0.5;
  float rays = ringNoise(turn + uTime * 0.0007, 31.0) * 0.55
             + ringNoise(turn - uTime * 0.0011, 83.0) * 0.30
             + ringNoise(turn + uTime * 0.0004, 197.0) * 0.15;
  rays = pow(rays, 2.0) * 2.4;
  float flicker = 0.94 + 0.06 * sin(uTime * 0.9) * sin(uTime * 0.37);

  vec3 flare = vec3(0.0);
  flare += vec3(1.00, 0.98, 0.96) * gauss(r, 27.0) * 2.6;
  flare += vec3(1.00, 0.88, 0.84) * gauss(r, 60.0) * 0.85;
  flare += vec3(0.62, 0.50, 1.00) * exp(-r / 85.0) * 0.34 * smoothstep(-20.0, 30.0, d);
  // A compact starburst: it dies out within a couple of hundred pixels, like a real lens.
  flare += vec3(0.80, 0.34, 0.15) * exp(-r / 58.0) * (0.35 + rays) * smoothstep(2.0, 46.0, r) * 1.05;
  flare += vec3(0.50, 0.20, 0.09) * gauss(r, 150.0) * (0.10 + rays * 0.16);
  // The sun pours light sideways along the limb.
  flare += vec3(1.00, 0.93, 0.95) * gauss(d - 1.0, 9.0) * exp(-r / 210.0) * 1.3;
  light += flare * uFlare * flicker;

  // Lens ghosts: faint discs strung along the line from the sun toward the pointer.
  vec2 axis = mix(uResolution / uDpr * 0.5, uPointer, 0.65) - sun;
  for (int i = 0; i < 3; i++) {
    float k = i == 0 ? 0.55 : (i == 1 ? 1.25 : 1.85);
    float size = (i == 0 ? 9.0 : (i == 1 ? 15.0 : 7.0)) * s;
    float disc = smoothstep(size, size * 0.45, length(p - (sun + axis * k)));
    light += vec3(0.36, 0.30, 0.95) * disc * 0.11 * uFlare;
  }

  // Film grain rides on the light, as it does on a long exposure.
  float grain = hash(gl_FragCoord.xy + fract(uTime * 0.71) * 311.0) - 0.5;
  light *= 1.0 + grain * 0.62;

  vec3 night = vec3(0.039, 0.043, 0.063);
  vec3 colour = night + (1.0 - exp(-light * 1.25)) + grain * 0.012;
  gl_FragColor = vec4(colour, 1.0);
}
`;

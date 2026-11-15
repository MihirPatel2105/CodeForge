"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { HORIZON_FRAGMENT, HORIZON_VERTEX } from "./horizon-shader";

/** The light is soft and slow; beyond this density the extra pixels only cost GPU time. */
const MAX_PIXEL_RATIO = 1.5;
/** The sun never wanders past the outer stages. */
const MAX_SUN_ANGLE = 0.34;
const START_SUN_ANGLE = -0.27;
const STILL_SUN_ANGLE = -0.17;
/** Fraction of the remaining distance the sun covers per second: a slow, heavy drift. */
const SUN_FOLLOW_RATE = 0.55;
const GHOST_FOLLOW_RATE = 2.2;
const MAX_FRAME_SECONDS = 0.05;
/** Entrance, in seconds from first mount: the limb first, the sun once the headline has landed. */
const ARC_IN = { start: 0.15, length: 1.6 };
const FLARE_IN = { start: 1.9, length: 1.5 };

const ramp = (time: number, window: { start: number; length: number }) => {
  const t = Math.min(1, Math.max(0, (time - window.start) / window.length));
  return 1 - (1 - t) ** 3;
};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  const shaders = [[gl.VERTEX_SHADER, HORIZON_VERTEX], [gl.FRAGMENT_SHADER, HORIZON_FRAGMENT]].map(([type, source]) => {
    const shader = gl.createShader(type as number);
    if (!shader) return null;
    gl.shaderSource(shader, source as string);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    return shader;
  });
  gl.linkProgram(program);
  // A linked program keeps what it needs; the shader objects can go either way.
  for (const shader of shaders) if (shader) gl.deleteShader(shader);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

/**
 * The hero's sky: a planet limb with the sun on it, drawn per pixel. The arc is measured
 * from the stage labels in the DOM, so the light always passes through the five agents.
 * The sun drifts on its own; only the faint lens ghosts respond to the pointer.
 */
export function HorizonCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useMotionPreference();
  // Survive effect re-runs (a motion-preference change, a restored context) without replaying the entrance.
  const motion = useRef({ clock: 0, sun: START_SUN_ANGLE });
  const [contextEpoch, setContextEpoch] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    // By class, not tag: the landing hero is a <section>, the auth panel an <aside>.
    const hero = canvas?.closest<HTMLElement>(".lh-hero");
    const orbit = hero?.querySelector<HTMLElement>(".lh-orbit");
    const marker = hero?.querySelector<HTMLElement>(".lh-node i");
    if (!canvas || !hero || !orbit || !marker) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    const program = gl && !gl.isContextLost() ? createProgram(gl) : null;
    if (!gl || !program) {
      hero.setAttribute("data-webgl", "off");
      return;
    }
    hero.setAttribute("data-webgl", "on");
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = {
      resolution: uniform("uResolution"), dpr: uniform("uDpr"), time: uniform("uTime"),
      centre: uniform("uCentre"), radius: uniform("uRadius"), sun: uniform("uSun"),
      pointer: uniform("uPointer"), arc: uniform("uArc"), flare: uniform("uFlare"),
    };

    const state = motion.current;
    const scene = { width: 0, height: 0, dpr: 1, centreX: 0, centreY: 0, radius: 1 };
    const pointer = { active: false, x: 0, y: 0 };
    const ghost = { x: 0, y: 0, placed: false };
    let visible = true;
    let lost = false;
    let frame = 0;
    let last = 0;

    /** Only touches the DOM when a value actually changes. */
    const publish = (key: string, value: string) => {
      if (canvas.dataset[key] !== value) canvas.dataset[key] = value;
    };

    // Read every frame: fonts, the mobile notice or a monitor change can move the arc
    // without resizing anything an observer would catch.
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      const centre = orbit.getBoundingClientRect();
      const dot = marker.getBoundingClientRect();
      scene.dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      scene.width = box.width;
      scene.height = box.height;
      scene.centreX = centre.left - box.left;
      scene.centreY = centre.top - box.top;
      scene.radius = Math.max(1, Math.hypot(dot.left + dot.width / 2 - centre.left, dot.top + dot.height / 2 - centre.top));
      const width = Math.round(box.width * scene.dpr);
      const height = Math.round(box.height * scene.dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      if (!ghost.placed) { ghost.x = box.width / 2; ghost.y = box.height * 0.3; ghost.placed = true; }
    };

    const draw = (arc: number, flare: number) => {
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.dpr, scene.dpr);
      gl.uniform1f(uniforms.time, state.clock);
      gl.uniform2f(uniforms.centre, scene.centreX, scene.centreY);
      gl.uniform1f(uniforms.radius, scene.radius);
      gl.uniform1f(uniforms.sun, state.sun);
      gl.uniform2f(uniforms.pointer, ghost.x, ghost.y);
      gl.uniform1f(uniforms.arc, arc);
      gl.uniform1f(uniforms.flare, flare);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      publish("sun", state.sun.toFixed(2));
    };

    const tick = (now: number) => {
      frame = 0;
      const delta = Math.min(MAX_FRAME_SECONDS, last ? (now - last) / 1000 : 0);
      last = now;
      state.clock += delta;
      measure();

      // The sun keeps its own slow course along the limb; the pointer never steers it.
      const target = clamp(0.2 * Math.sin(state.clock * 0.11 - 1.4), -MAX_SUN_ANGLE, MAX_SUN_ANGLE);
      publish("sunTarget", target.toFixed(2));
      state.sun += (target - state.sun) * (1 - Math.exp(-delta * SUN_FOLLOW_RATE));
      const ease = 1 - Math.exp(-delta * GHOST_FOLLOW_RATE);
      ghost.x += ((pointer.active ? pointer.x : scene.width / 2) - ghost.x) * ease;
      ghost.y += ((pointer.active ? pointer.y : scene.height * 0.3) - ghost.y) * ease;

      draw(ramp(state.clock, ARC_IN), ramp(state.clock, FLARE_IN));
      schedule();
    };
    const schedule = () => {
      const running = visible && !lost && !document.hidden && !reducedMotion;
      publish("state", reducedMotion ? "still" : running ? "running" : "paused");
      if (running && !frame) frame = requestAnimationFrame(tick);
      if (!running) { last = 0; if (frame) { cancelAnimationFrame(frame); frame = 0; } }
    };

    const drawStill = () => {
      if (!reducedMotion || lost) return;
      state.sun = STILL_SUN_ANGLE;
      measure();
      draw(1, 1);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const box = canvas.getBoundingClientRect();
      pointer.active = true;
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
    };
    const onPointerLeave = () => { pointer.active = false; };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      hero.setAttribute("data-webgl", "off");
      schedule();
    };
    // A restored context has none of the old program or buffer: rebuild from scratch.
    const onContextRestored = () => setContextEpoch((epoch) => epoch + 1);

    const resizeObserver = new ResizeObserver(drawStill);
    resizeObserver.observe(hero);
    const viewObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    viewObserver.observe(hero);
    hero.addEventListener("pointermove", onPointerMove);
    hero.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", schedule);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    void document.fonts.ready.then(drawStill);
    drawStill();
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      lost = true;
      resizeObserver.disconnect();
      viewObserver.disconnect();
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", schedule);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [reducedMotion, contextEpoch]);

  return <canvas ref={canvasRef} className="lh-world" aria-hidden />;
}

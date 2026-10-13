"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionPreference } from "@/lib/use-motion-preference";

const modules = [
  { name: "Data models", code: "Book / title / author", short: "MODELS" },
  { name: "Routes", code: "GET /books", short: "ROUTES" },
  { name: "Validation", code: "BookCreate → BookOut", short: "SCHEMAS" },
  { name: "Tests", code: "5 example checks", short: "TESTS" },
  { name: "API service", code: "Library API", short: "SERVICE" },
];

export function ApiMachine() {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef({ paused: false, restart: false });
  const requestRender = useRef<(() => void) | null>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState(0);
  const reducedMotion = useMotionPreference();

  useEffect(() => {
    const element = host.current;
    if (!element || reducedMotion) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("three").then(async (THREE) => {
      const { RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js");
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      } catch { return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x111314, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      renderer.domElement.setAttribute("aria-hidden", "true");
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 60);
      camera.position.set(8, 7, 10);
      camera.lookAt(0, 1, 0);
      const machine = new THREE.Group();
      scene.add(machine);
      scene.add(new THREE.HemisphereLight(0xe6edff, 0x4c4030, 2.8));
      const key = new THREE.DirectionalLight(0xffffff, 5);
      key.position.set(-3, 7, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffd18b, 2);
      rim.position.set(5, 3, -5);
      scene.add(rim);

      const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
      const materials: InstanceType<typeof THREE.Material>[] = [];
      const textures: InstanceType<typeof THREE.Texture>[] = [];
      const metal = new THREE.MeshStandardMaterial({ color: 0x555b5e, metalness: 0.72, roughness: 0.35 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x202426, metalness: 0.5, roughness: 0.42 });
      const silver = new THREE.MeshStandardMaterial({ color: 0xc1c7c9, metalness: 0.5, roughness: 0.3 });
      const amber = new THREE.MeshStandardMaterial({ color: 0xffbc62, emissive: 0xb25a10, emissiveIntensity: 0.5, roughness: 0.4 });
      materials.push(metal, dark, silver, amber);
      const box = (width: number, height: number, depth: number, material: InstanceType<typeof THREE.Material> | InstanceType<typeof THREE.Material>[], x: number, y: number, z: number, radius = 0.04) => {
        const geometry = new RoundedBoxGeometry(width, height, depth, 2, radius);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        machine.add(mesh);
        return mesh;
      };

      // A machined platform, recessed conveyor, and a fixed assembly gantry.
      box(8.8, 0.22, 4.4, dark, -0.4, -0.12, 0, 0.1);
      box(8.5, 0.055, 4.1, metal, -0.4, 0.02, 0, 0.02);
      box(6.9, 0.14, 1.9, dark, -0.7, 0.12, 0, 0.035);
      box(7, 0.09, 0.065, silver, -0.7, 0.24, -1.05);
      box(7, 0.09, 0.065, silver, -0.7, 0.24, 1.05);
      for (let i = 0; i < 22; i++) box(0.075, 0.03, 1.8, metal, -4 + i * 0.3, 0.21, 0, 0.01);
      box(2.65, 0.22, 2.55, dark, 0.65, 0.25, 0, 0.08);
      box(2.4, 0.05, 2.3, silver, 0.65, 0.39, 0, 0.02);
      box(0.17, 3.5, 0.23, metal, 2.35, 1.8, -1.5);
      box(0.17, 3.5, 0.23, metal, -1.05, 1.8, -1.5);
      box(3.57, 0.2, 0.3, silver, 0.65, 3.6, -1.5);
      box(2.8, 0.045, 0.08, amber, 0.65, 3.47, -1.3, 0.015);
      const carriage = box(0.7, 0.35, 0.65, dark, 0.65, 3.5, -1.25, 0.06);
      const scanner = box(2.1, 0.075, 0.1, amber, 0.65, 2.9, -0.15, 0.025);
      const scannerArm = box(0.07, 0.45, 0.07, silver, 0.65, 3.17, -0.15, 0.01);
      // Socket indicators and corner fixings make the machine feel physical.
      for (const x of [-4.45, 3.65]) for (const z of [-1.9, 1.9]) box(0.12, 0.035, 0.12, dark, x, 0.065, z, 0.025);
      for (let i = 0; i < 5; i++) box(0.16, 0.04, 0.12, amber, 2.65 + i * 0.23, 0.065, 1.8, 0.02);

      const slabs = modules.map((module, index) => {
        const canvas = document.createElement("canvas");
        canvas.width = 768; canvas.height = 512;
        const ctx = canvas.getContext("2d");
        if (!ctx) return box(2.1, 0.27, 1.65, silver, -3.2, 0.5, 0);
        ctx.fillStyle = index === 4 ? "#edba76" : "#d3d8d7";
        ctx.fillRect(0, 0, 768, 512);
        ctx.strokeStyle = index === 4 ? "#ba8b50" : "#b1b9b6";
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 30, 708, 452);
        ctx.fillStyle = "#68736c";
        ctx.font = "22px monospace";
        ctx.fillText(`CF / 0${index + 1}`, 65, 100);
        ctx.fillStyle = "#28352e";
        ctx.font = "bold 56px monospace";
        ctx.fillText(module.short, 65, 205);
        ctx.font = "25px monospace";
        ctx.fillText(module.code, 65, 265);
        ctx.fillStyle = "#7c8980";
        for (let i = 0; i < 18; i++) ctx.fillRect(65 + i * 7, 375, i % 3 === 0 ? 4 : 2, 38);
        ctx.font = "18px monospace";
        ctx.fillText("CODEFORGE / BUILD COMPONENT", 280, 405);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.push(texture);
        const top = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.15 });
        materials.push(top);
        return box(2.1, 0.27, 1.65, [silver, silver, top, dark, silver, silver], -3.2, 0.55, 0, 0.055);
      });
      const seamGeometry = new THREE.BoxGeometry(2.12, 0.018, 1.67);
      geometries.push(seamGeometry);
      const seams = slabs.map(() => {
        const seam = new THREE.Mesh(seamGeometry, amber);
        machine.add(seam);
        return seam;
      });
      const grid = new THREE.GridHelper(24, 48, 0x303639, 0x222729);
      grid.position.y = -0.25;
      scene.add(grid);
      geometries.push(grid.geometry);
      if (Array.isArray(grid.material)) materials.push(...grid.material);
      else materials.push(grid.material);

      let frame = 0;
      let visible = true;
      let elapsed = 0;
      let lastTime = 0;
      let lastStage = -1;
      const pointer = { x: 0, y: 0 };
      const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
      const draw = (now: number) => {
        frame = 0;
        if (disposed || !visible || document.hidden) { lastTime = 0; return; }
        if (controls.current.restart) { elapsed = 0; controls.current.restart = false; }
        if (lastTime && !controls.current.paused) elapsed += Math.min(now - lastTime, 60) / 1000;
        lastTime = now;
        const cycle = elapsed % 17;
        const nextStage = Math.min(5, Math.floor(cycle / 2.6));
        if (lastStage !== nextStage) { lastStage = nextStage; setStage(nextStage); }
        for (let i = 0; i < slabs.length; i++) {
          const progress = (cycle - i * 2.6) / 2.6;
          const incoming = ease(progress / 0.45);
          const placed = ease((progress - 0.45) / 0.55);
          const finalY = 0.57 + i * 0.31;
          slabs[i].visible = progress >= 0;
          slabs[i].position.set(-3.3 + incoming * 3.95, finalY + (1 - placed) * Math.sin(incoming * Math.PI / 2) * 1.5, 0);
          slabs[i].rotation.y = (1 - incoming) * -0.09;
          seams[i].visible = progress >= 1;
          seams[i].position.set(0.65, finalY - 0.135, 0);
        }
        const lift = nextStage < 5 ? 0.4 * Math.sin((cycle % 2.6) / 2.6 * Math.PI) : 0;
        scanner.position.y = 2.7 + lift;
        scanner.position.z = -0.7 + Math.sin(cycle * 0.7) * 0.35;
        scannerArm.position.y = scanner.position.y + 0.25;
        scannerArm.position.z = scanner.position.z;
        carriage.position.x = 0.65 + Math.sin(cycle * 0.7) * 0.3;
        machine.rotation.y += (pointer.x * 0.08 - machine.rotation.y) * 0.04;
        machine.rotation.x += (pointer.y * 0.025 - machine.rotation.x) * 0.04;
        renderer.render(scene, camera);
        if (!controls.current.paused) frame = requestAnimationFrame(draw);
      };
      const resume = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw); };
      requestRender.current = resume;
      const resize = () => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        const aspect = width / height;
        const halfWidth = Math.max(5.6, aspect * 3.7);
        camera.left = -halfWidth; camera.right = halfWidth;
        camera.top = halfWidth / aspect; camera.bottom = -halfWidth / aspect;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        resume();
      };
      const move = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        const bounds = element.getBoundingClientRect();
        pointer.x = (event.clientX - bounds.left) / bounds.width - 0.5;
        pointer.y = (event.clientY - bounds.top) / bounds.height - 0.5;
      };
      const reset = () => { pointer.x = 0; pointer.y = 0; };
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
        else resume();
      });
      observer.observe(element);
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(element);
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", reset);
      document.addEventListener("visibilitychange", resume);
      resize();
      setReady(true);
      cleanup = () => {
        requestRender.current = null;
        cancelAnimationFrame(frame);
        observer.disconnect(); resizeObserver.disconnect();
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerleave", reset);
        document.removeEventListener("visibilitychange", resume);
        geometries.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());
        textures.forEach(texture => texture.dispose());
        renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      };
    }).catch(() => { /* Keep the illustrated machine if 3D is unavailable. */ });
    return () => { disposed = true; cleanup?.(); };
  }, [reducedMotion]);

  const animated = ready && !reducedMotion;
  const currentStage = animated ? stage : 5;
  return (
    <div className="machine-workbench">
      <div className="machine-topline"><span><i /> ASSEMBLY LINE / LIBRARY API</span><span>EXAMPLE BUILD</span></div>
      <div ref={host} className="machine-canvas" data-rendered={animated} role="img" aria-label="A 3D assembly machine stacks data models, routes, validation, tests, and a service into an API">
        <svg className="machine-fallback" viewBox="0 0 900 480" aria-hidden="true">
          <path d="M100 330 520 440 790 295 370 190Z" fill="#343a3e" stroke="#60696e" />
          <path d="M390 245V75H670V245" fill="none" stroke="#8d989d" strokeWidth="12" />
          {modules.map((module, index) => <g key={module.short} transform={`translate(0 ${-index * 30})`}><path d="m350 295 185 50 145-80-185-50Z" fill={index === 4 ? "#d3a369" : "#b4bfc1"} stroke="#1c2327" /><path d="m350 295v20l185 50v-20m0 20 145-80v-20" fill="#576269" stroke="#20272c" /><text x="460" y="290" fill="#242c2e" fontFamily="monospace" fontSize="13" transform="rotate(15 460 290)">{module.short}</text></g>)}
          <path d="M410 105H650" stroke="#e7af64" strokeWidth="4" />
        </svg>
      </div>
      <div className="machine-terminal" aria-live="polite"><span>OUTPUT / EXAMPLE</span><code>{currentStage === 5 ? "GET /books → 200 OK" : `assembling ${modules[currentStage].short.toLowerCase()}…`}</code><p>{currentStage === 5 ? "5 checks passed · ready for handoff" : `${currentStage + 1} of 5 components`}</p></div>
      <div className="machine-bottomline"><span>IDEA <b>→</b> COMPONENTS <b>→</b> WORKING API</span><div><button type="button" disabled={!animated || reducedMotion} aria-pressed={paused} onClick={() => { controls.current.paused = !paused; setPaused(!paused); requestRender.current?.(); }}>{paused ? "Play" : "Pause"}</button><button type="button" disabled={!animated || reducedMotion} onClick={() => { controls.current.restart = true; controls.current.paused = false; setPaused(false); requestRender.current?.(); }}>Replay ↻</button></div></div>
      <ol className="machine-progress" aria-label="API assembly components">{modules.map((module, index) => <li key={module.name} data-state={index < currentStage ? "done" : index === currentStage ? "active" : "waiting"}><span>0{index+1}</span><strong>{module.name}</strong><small>{index < currentStage ? "Assembled" : index === currentStage ? "Assembling" : "Queued"}</small></li>)}</ol>
    </div>
  );
}

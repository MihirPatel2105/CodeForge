"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionPreference } from "@/lib/use-motion-preference";

const agents = [
  { name: "PM", task: "Turns your idea into requirements for you to approve.", position: [-2.5, 0.25, 0] },
  { name: "Architect", task: "Designs the routes and models for your approval.", position: [-1.05, 1.45, -0.2] },
  { name: "Coder", task: "Builds the endpoints and the logic behind them.", position: [1.05, 1.05, 0.15] },
  { name: "Reviewer", task: "Checks the code and sends back improvements.", position: [2.4, -0.55, -0.15] },
  { name: "Tester", task: "Exercises the API and reports what passes.", position: [-0.2, -1.45, 0.25] },
] as const;

export function AgentNetwork() {
  const host = useRef<HTMLDivElement>(null);
  const active = useRef(0);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const reducedMotion = useMotionPreference();

  useEffect(() => {
    const element = host.current;
    if (!element || reducedMotion || paused) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void import("three").then((THREE) => {
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute("aria-hidden", "true");
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
      camera.position.set(0, 0, 9.8);
      const group = new THREE.Group();
      scene.add(group);
      scene.add(new THREE.AmbientLight(0xffffff, 2));
      const light = new THREE.DirectionalLight(0xffffff, 4);
      light.position.set(-3, 5, 6);
      scene.add(light);

      const coreGeometry = new THREE.OctahedronGeometry(0.24, 0);
      const ringGeometry = new THREE.TorusGeometry(0.42, 0.017, 8, 64);
      const packetGeometry = new THREE.SphereGeometry(0.045, 8, 8);
      const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x343638, metalness: 0.8, roughness: 0.28 });
      const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x969a9d, transparent: true, opacity: 0.5 });
      const packetMaterial = new THREE.MeshBasicMaterial({ color: 0x626b65 });
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xadb3ad, transparent: true, opacity: 0.5 });
      const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x52685c });
      const positions = agents.map((agent) => new THREE.Vector3(...agent.position));
      const cores: InstanceType<typeof THREE.Mesh>[] = [];
      positions.forEach((position, index) => {
        const node = new THREE.Group();
        node.position.copy(position);
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.rotation.set(0.3, index * 0.4, 0.3);
        cores.push(core);
        node.add(core);
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = 0.4;
        node.add(ring);
        const secondRing = new THREE.Mesh(ringGeometry, ringMaterial);
        secondRing.rotation.set(1.2, 0.8, 0);
        node.add(secondRing);
        group.add(node);
      });
      const halo = new THREE.Mesh(ringGeometry, haloMaterial);
      halo.scale.setScalar(1.3);
      group.add(halo);
      const paths = positions.slice(0, -1).map((position, index) => {
        const end = positions[index + 1];
        const mid = position.clone().lerp(end, 0.5);
        mid.z -= 0.55;
        return new THREE.QuadraticBezierCurve3(position, mid, end);
      });
      const lineGeometries = paths.map((path) => new THREE.BufferGeometry().setFromPoints(path.getPoints(48)));
      lineGeometries.forEach((geometry) => group.add(new THREE.Line(geometry, lineMaterial)));
      const packets = paths.map(() => {
        const packet = new THREE.Mesh(packetGeometry, packetMaterial);
        group.add(packet);
        return packet;
      });
      let frame = 0;
      let visible = true;
      let elapsed = 0;
      let lastTime = 0;
      const pointer = { x: 0, y: 0 };
      const projected = new THREE.Vector3();
      const labels = Array.from(element.querySelectorAll<HTMLElement>(".network-node-label"));
      const draw = (now: number) => {
        frame = 0;
        if (disposed || !visible || document.hidden) { lastTime = 0; return; }
        if (lastTime) elapsed += Math.min(now - lastTime, 50) / 1000;
        lastTime = now;
        group.rotation.y += (pointer.x * 0.12 - group.rotation.y) * 0.045;
        group.rotation.x += (-pointer.y * 0.09 - group.rotation.x) * 0.045;
        for (let i = 0; i < cores.length; i++) cores[i].rotation.y = elapsed * 0.16 + i * 0.4;
        for (let i = 0; i < packets.length; i++) paths[i].getPoint((elapsed * 0.18 + i * 0.23) % 1, packets[i].position);
        halo.position.copy(positions[active.current]);
        renderer.render(scene, camera);
        for (let i = 0; i < positions.length; i++) {
          projected.copy(positions[i]).applyMatrix4(group.matrixWorld).project(camera);
          labels[i].style.transform = `translate(${(projected.x * 0.5 + 0.5) * element.clientWidth}px, ${(-projected.y * 0.5 + 0.5) * element.clientHeight + 36}px) translateX(-50%)`;
        }
        frame = requestAnimationFrame(draw);
      };
      const resume = () => {
        if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
      };
      const resize = () => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.position.z = width < 460 ? 12.3 : 9.8;
        camera.updateProjectionMatrix();
        resume();
      };
      const move = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        const bounds = element.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      };
      const resetPointer = () => { pointer.x = 0; pointer.y = 0; };
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
        else resume();
      });
      observer.observe(element);
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(element);
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", resetPointer);
      document.addEventListener("visibilitychange", resume);
      resize();
      setReady(true);
      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        resizeObserver.disconnect();
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerleave", resetPointer);
        document.removeEventListener("visibilitychange", resume);
        coreGeometry.dispose(); ringGeometry.dispose(); packetGeometry.dispose();
        coreMaterial.dispose(); ringMaterial.dispose(); packetMaterial.dispose(); lineMaterial.dispose(); haloMaterial.dispose();
        lineGeometries.forEach((geometry) => geometry.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        labels.forEach((label) => label.style.removeProperty("transform"));
      };
    }).catch(() => { /* The static diagram remains available if 3D cannot load. */ });

    return () => { disposed = true; cleanup?.(); };
  }, [reducedMotion, paused]);

  const animated = ready && !reducedMotion && !paused;
  return (
    <div className="network-visual">
      <div className="network-scene-heading"><span>THE BUILD NETWORK</span><span><i /> Five specialists</span></div>
      <div ref={host} className="network-scene" data-animated={animated} role="group" aria-label="Five connected agents: PM, Architect, Coder, Reviewer, Tester">
        <svg className="network-static" viewBox="0 0 600 400" aria-hidden="true"><path d="M90 180 Q130 70 220 100 T380 125 T500 250 T280 320" fill="none" stroke="currentColor" strokeWidth="1" />{[[90,180],[220,100],[380,125],[500,250],[280,320]].map(([x,y],i) => <g key={i}><circle cx={x} cy={y} r="25" fill="#f4f5f2" stroke="currentColor" /><path d={`M${x} ${y-13}l13 13-13 13-13-13z`} fill="#535b55" /></g>)}</svg>
        {agents.map((agent, index) => <span key={agent.name} className={`network-node-label network-label-${index}`} aria-hidden="true">{agent.name}</span>)}
      </div>
      <div className="network-controls"><span>{animated ? "Move your cursor to explore" : "A connected workflow"}</span><button type="button" aria-pressed={paused} disabled={reducedMotion} onClick={() => { setReady(false); setPaused(!paused); }}>{paused ? "Play motion" : "Pause motion"}</button></div>
      <div className="network-agent-tabs" role="group" aria-label="Explore the five agents">{agents.map((agent, index) => <button key={agent.name} type="button" aria-pressed={selected === index} onClick={() => { active.current = index; setSelected(index); }}><span>0{index+1}</span>{agent.name}</button>)}</div>
      <p className="network-agent-description" aria-live="polite">{agents[selected].task}</p>
    </div>
  );
}

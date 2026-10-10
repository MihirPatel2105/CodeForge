"use client";

import { useEffect, useRef } from "react";
import { useMotionPreference } from "@/lib/use-motion-preference";

export function ConstellationBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useMotionPreference();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let width = 0, height = 0, frame = 0, visible = true;
    let pointerX = 0, pointerY = 0, driftX = 0, driftY = 0;
    const nodes = [
      { x: .10, y: .27, label: "PM", phase: 0 },
      { x: .20, y: .66, label: "ARCHITECT", phase: 1.8 },
      { x: .84, y: .23, label: "CODER", phase: 3.2 },
      { x: .92, y: .45, label: "REVIEWER", phase: 4.7 },
      { x: .79, y: .72, label: "TESTER", phase: 6.0 },
    ];
    const positions = nodes.map(() => ({ x: 0, y: 0 }));
    const edges = [[0, 1], [2, 3], [3, 4]];
    const particles = Array.from({ length: 260 }, (_, i) => {
      const z = 1 - 2 * (i + .5) / 260, angle = i * 2.3999632297;
      const r = Math.sqrt(1 - z*z);
      return { x: Math.cos(angle)*r, y: Math.sin(angle)*r, z };
    });
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      const mobile = width <= 700;
      const t = reduced ? 0 : now / 1000;
      driftX += (pointerX - driftX) * .035; driftY += (pointerY - driftY) * .035;
      ctx.clearRect(0, 0, width, height);
      // Keep the headline area quiet while giving the outer field depth.
      for (let x = 16; x < width; x += 30) for (let y = 18; y < height; y += 30) {
        const centre = Math.abs(x / width - .5);
        ctx.fillStyle = `rgba(35,42,48,${centre < .28 && y < 470 ? .035 : .12})`;
        ctx.beginPath(); ctx.arc(x, y, .65, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        positions[i].x = n.x * width + (reduced ? 0 : Math.sin(t * .25 + n.phase) * 9 + driftX);
        positions[i].y = n.y * height + (reduced ? 0 : Math.cos(t * .3 + n.phase) * 11 + driftY);
      }
      for (let i = 0; i < edges.length; i++) {
        const a = positions[edges[i][0]], b = positions[edges[i][1]];
        const cx = i === 0 ? -width*.03 : width*1.01, cy = (a.y+b.y)/2;
        ctx.strokeStyle = "rgba(55,65,72,.11)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y); ctx.stroke();
        const p = (t * .09 + i * .2) % 1, q = 1 - p;
        const px = q*q*a.x + 2*q*p*cx + p*p*b.x, py = q*q*a.y + 2*q*p*cy + p*p*b.y;
        ctx.fillStyle = "rgba(45,55,62,.5)"; ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI*2); ctx.fill();
      }
      for (let i = 0; i < nodes.length; i++) {
        const p = positions[i], radius = mobile ? 23 : (i === 0 || i === 2 ? 62 : 40);
        const rotation = t*.13 + nodes[i].phase;
        const cos = Math.cos(rotation), sin = Math.sin(rotation);
        const glow = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius*2.5);
        glow.addColorStop(0,"rgba(155,169,176,.17)"); glow.addColorStop(1,"rgba(155,169,176,0)");
        ctx.fillStyle = glow; ctx.fillRect(p.x-radius*2.5,p.y-radius*2.5,radius*5,radius*5);
        ctx.strokeStyle = "rgba(65,78,86,.18)"; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.ellipse(p.x,p.y,radius*1.5,radius*.44,-.5,0,Math.PI*2); ctx.stroke();
        for (let j = 0; j < (mobile ? 130 : particles.length); j++) {
          const particle = particles[mobile ? j * 2 : j];
          const x = particle.x*cos+particle.z*sin;
          const depth = (-particle.x*sin+particle.z*cos+1)/2;
          ctx.fillStyle = `rgba(44,59,68,${.12+depth*.58})`;
          ctx.beginPath(); ctx.arc(p.x+x*radius,p.y+particle.y*radius,.45+depth*.65,0,Math.PI*2); ctx.fill();
        }
        if (!mobile) {
          ctx.font = "10px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#66737c";
          ctx.fillText(`0${i+1} / ${nodes[i].label}`,p.x,p.y+radius+32);
          ctx.fillStyle = "rgba(65,78,86,.35)"; ctx.fillRect(p.x-12,p.y+radius+42,24,1);
        }
      }
      if (!reduced) frame = requestAnimationFrame(draw);
    };
    const start = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw); };
    const move = (e: PointerEvent) => { if (e.pointerType === "touch" || reduced) return; pointerX = (e.clientX / innerWidth - .5) * 16; pointerY = (e.clientY / innerHeight - .5) * 12; };
    const observer = new ResizeObserver(() => { resize(); start(); }); observer.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) { cancelAnimationFrame(frame); frame = 0; } else start(); }); intersection.observe(canvas);
    window.addEventListener("pointermove", move, { passive: true }); document.addEventListener("visibilitychange", start);
    resize(); start();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); window.removeEventListener("pointermove", move); document.removeEventListener("visibilitychange", start); };
  }, [reduced]);
  return <canvas ref={ref} className="constellation-canvas" aria-hidden="true" />;
}


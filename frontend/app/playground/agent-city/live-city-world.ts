import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PIPELINE_STAGES, type PipelineStageId } from "@/lib/pipeline";
import type { RunSnapshot } from "@/lib/run-reducer";
import type { AgentCardState } from "@/lib/types";

export type LiveCityWorldState = {
  snapshot: RunSnapshot;
  selected: PipelineStageId;
  reducedMotion: boolean;
  paused: boolean;
  night: boolean;
  follow: boolean;
};

const DISTRICTS: { id: PipelineStageId; x: number; z: number; color: string; height: number }[] = [
  { id: "pm", x: -6.4, z: -3.9, color: "#d39968", height: 3.25 },
  { id: "architect", x: 0, z: -6.5, color: "#8aa7c0", height: 3.5 },
  { id: "coder", x: 6.4, z: -3.7, color: "#9fb39b", height: 4.5 },
  { id: "reviewer", x: 6.4, z: 3.6, color: "#ac9cbf", height: 3.3 },
  { id: "tester", x: 0, z: 6.6, color: "#c9979a", height: 3.4 },
  { id: "sandbox", x: -6.4, z: 3.6, color: "#7ba7a3", height: 3.15 },
];

const STATUS: Record<AgentCardState, { color: string; text: string }> = {
  idle: { color: "#89908e", text: "Waiting" },
  working: { color: "#d69c51", text: "Working" },
  done: { color: "#248b69", text: "Complete" },
  failed: { color: "#cf615e", text: "Failed" },
  stopped: { color: "#a5a2a0", text: "Stopped" },
};

export function createLiveCity(
  host: HTMLDivElement,
  initial: LiveCityWorldState,
  onSelect: (stage: PipelineStageId) => void,
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-label", "Live Agent City. Drag to orbit, use plus or minus to zoom, or click a building to inspect its recorded work. Use the stage controls for keyboard selection.");
  canvas.setAttribute("role", "img");
  canvas.tabIndex = -1;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "pan-y";
  host.appendChild(canvas);

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const geometryCache = new Map<string, THREE.BufferGeometry>();
  const initializationCleanup: (() => void)[] = [];
  try {
  const clickable: THREE.Object3D[] = [];
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-15, 15, 12, -12, 0.1, 100);
  const homeOrbit = new THREE.Spherical().setFromVector3(new THREE.Vector3(21, 25, 28));
  const orbit = homeOrbit.clone();
  const lookAt = new THREE.Vector3(0, 0.8, 0);
  const wantedLookAt = lookAt.clone();
  let zoomFactor = 1;
  let state = initial;
  let disposed = false;
  let visible = true;
  let contextLost = false;
  let frame = 0;
  let lastFrame = 0;
  let time = 0;
  let dirty = true;
  initializationCleanup.push(() => { disposed = true; if (frame) cancelAnimationFrame(frame); });
  let stageBefore = activeStage(initial.snapshot);
  let loopBefore = loopKey(initial.snapshot);
  let travel: { curve: THREE.CatmullRomCurve3; elapsed: number; repair: boolean } | null = null;
  let gesture: { id: number; x: number; y: number; theta: number; phi: number; moved: boolean; touch: boolean } | null = null;

  function activeStage(snapshot: RunSnapshot): PipelineStageId | null {
    return PIPELINE_STAGES.find(stage => snapshot.agents[stage.id].state === "working")?.id ?? null;
  }
  function loopKey(snapshot: RunSnapshot) {
    return snapshot.lastLoop ? `${snapshot.runId}:${snapshot.lastLoop.at}:${snapshot.lastLoop.iteration}` : "";
  }
  function material(color: THREE.ColorRepresentation, roughness = 0.8, metalness = 0) {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(value);
    return value;
  }
  function geometry(key: string, create: () => THREE.BufferGeometry) {
    let value = geometryCache.get(key);
    if (!value) { value = create(); geometryCache.set(key, value); geometries.add(value); }
    return value;
  }
  function mesh(shape: THREE.BufferGeometry, paint: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) {
    geometries.add(shape);
    const value = new THREE.Mesh(shape, paint);
    value.position.set(x, y, z);
    value.castShadow = true;
    value.receiveShadow = true;
    parent.add(value);
    return value;
  }
  function box(w: number, h: number, d: number, paint: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, radius = 0.045) {
    return mesh(geometry(`b:${w}:${h}:${d}:${radius}`, () => new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 3, h / 3, d / 3))), paint, x, y, z, parent);
  }
  function cylinder(r: number, h: number, paint: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, sides = 24) {
    return mesh(geometry(`c:${r}:${h}:${sides}`, () => new THREE.CylinderGeometry(r, r, h, sides)), paint, x, y, z, parent);
  }
  function sphere(r: number, paint: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, detail = 1) {
    return mesh(geometry(`s:${r}:${detail}`, () => new THREE.IcosahedronGeometry(r, detail)), paint, x, y, z, parent);
  }
  function tube(points: THREE.Vector3[], radius: number, paint: THREE.Material, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points, closed);
    const value = mesh(new THREE.TubeGeometry(curve, closed ? 96 : 32, radius, 6, closed), paint, 0, 0, 0);
    value.castShadow = false;
    return value;
  }
  function ring(r: number, width: number, paint: THREE.Material, x: number, y: number, z: number) {
    const value = mesh(geometry(`r:${r}:${width}`, () => new THREE.RingGeometry(r - width, r, 64)), paint, x, y, z);
    value.rotation.x = -Math.PI / 2;
    value.castShadow = false;
    return value;
  }
  function ribbon(curve: THREE.CatmullRomCurve3, width: number, paint: THREE.Material) {
    const positions: number[] = [];
    const indices: number[] = [];
    const point = new THREE.Vector3(), tangent = new THREE.Vector3();
    for (let i = 0; i <= 128; i++) {
      curve.getPoint(i / 128, point); curve.getTangent(i / 128, tangent);
      for (const side of [-1, 1]) positions.push(point.x + tangent.z * width * side / 2, 0.13, point.z - tangent.x * width * side / 2);
      if (i < 128) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    shape.setIndex(indices); shape.computeVertexNormals();
    const value = mesh(shape, paint, 0, 0, 0);
    value.castShadow = false;
    return value;
  }
  function consolidate(group: THREE.Group) {
    const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of group.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const list = byMaterial.get(child.material) ?? [];
      list.push(child); byMaterial.set(child.material, list);
    }
    for (const [paint, parts] of byMaterial) {
      if (parts.length < 2) continue;
      const shapes = parts.map(part => {
        part.updateMatrix();
        return (part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()).applyMatrix4(part.matrix);
      });
      const merged = mergeGeometries(shapes);
      shapes.forEach(shape => shape.dispose());
      if (!merged) continue;
      parts.forEach(part => group.remove(part));
      mesh(merged, paint, 0, 0, 0, group);
    }
  }

  const pearl = material("#e9ebef");
  const chalk = material("#fafbfe");
  const concrete = material("#cbd0d8");
  const graphite = material("#303640");
  const darkGlass = material("#314558", 0.22, 0.4);
  const metal = material("#aab3c1", 0.25, 0.65);
  const timber = material("#a58c70");
  const soil = material("#7b8279");
  const green = material("#789283");
  const lightGreen = material("#a8b8a0");
  const lawn = material("#b4c0ad");
  const roadPaint = material("#a2aab7");
  const amber = material("#d4ac70", 0.5, 0.2);
  const windows = material("#8eabb1", 0.25, 0.25);
  const lampPaint = material("#f6e6ba", 0.5);
  lampPaint.emissive.set("#ffe3a5");
  const groundPaint = material("#edf0f5");

  const ambient = new THREE.HemisphereLight("#fff4de", "#849b94", 2.6);
  const sun = new THREE.DirectionalLight("#fff3da", 3.2);
  sun.position.set(-14, 24, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 65 });
  sun.shadow.normalBias = 0.06;
  sun.shadow.bias = -0.0003;
  const fill = new THREE.DirectionalLight("#a7c5e6", 0.65);
  fill.position.set(12, 10, -14);
  scene.add(ambient, sun, fill);

  const floor = mesh(new THREE.PlaneGeometry(300, 300), groundPaint, 0, -1.02, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  cylinder(11.15, 0.8, graphite, 0, -0.55, 0, scene, 96);
  cylinder(11.25, 0.16, concrete, 0, -0.11, 0, scene, 96);
  cylinder(11.18, 0.12, pearl, 0, 0.03, 0, scene, 96);
  ring(10.88, 0.055, chalk, 0, 0.1, 0);
  ring(10.96, 0.025, metal, 0, -0.26, 0);

  // Etched paving gives the miniature scale without adding a field of meshes.
  const pavingVertices: number[] = [];
  for (let line = -10; line <= 10; line += 1.25) {
    const extent = Math.sqrt(10.95 ** 2 - line ** 2);
    pavingVertices.push(line, 0.097, -extent, line, 0.097, extent);
    pavingVertices.push(-extent, 0.097, line, extent, 0.097, line);
  }
  const pavingGeometry = new THREE.BufferGeometry();
  pavingGeometry.setAttribute("position", new THREE.Float32BufferAttribute(pavingVertices, 3));
  geometries.add(pavingGeometry);
  const pavingPaint = new THREE.LineBasicMaterial({ color: "#a7afbf", transparent: true, opacity: 0.22, depthWrite: false });
  materials.add(pavingPaint);
  scene.add(new THREE.LineSegments(pavingGeometry, pavingPaint));

  const roadPoints = DISTRICTS.map(d => new THREE.Vector3(d.x * 0.69, 0.115, d.z * 0.69));
  const streetCurve = new THREE.CatmullRomCurve3(roadPoints, true);
  ribbon(streetCurve, 0.85, concrete);
  tube(roadPoints.map(p => p.clone().setY(0.14)), 0.012, roadPaint, true);
  for (let i = 0; i < 48; i++) {
    const point = streetCurve.getPoint(i / 48);
    const tangent = streetCurve.getTangent(i / 48);
    const mark = box(0.035, 0.015, 0.13, chalk, point.x, 0.155, point.z);
    mark.rotation.y = Math.atan2(tangent.x, tangent.z);
    mark.castShadow = false;
  }

  cylinder(2.35, 0.11, concrete, 0, 0.15, 0, scene, 64);
  cylinder(1.95, 0.12, chalk, 0, 0.26, 0, scene, 64);
  ring(1.72, 0.018, metal, 0, 0.325, 0);
  cylinder(0.9, 0.42, graphite, 0, 0.5, 0, scene, 48);
  cylinder(0.92, 0.06, metal, 0, 0.74, 0, scene, 48);
  const core = new THREE.Group();
  core.position.y = 1.55;
  scene.add(core);
  const coreGem = mesh(new THREE.OctahedronGeometry(0.78, 0), metal, 0, 0, 0, core);
  coreGem.rotation.z = 0.18;
  const orbitRing = mesh(new THREE.TorusGeometry(1.08, 0.035, 8, 64, Math.PI * 1.7), amber, 0, 0, 0, core);
  orbitRing.rotation.set(0.7, 0.1, -0.4);
  const centerStatus = material("#89908e", 0.3);
  const centerLight = ring(0.92, 0.035, centerStatus, 0, 0.777, 0);
  centerLight.renderOrder = 1;

  type Station = {
    id: PipelineStageId;
    group: THREE.Group;
    indicator: THREE.MeshStandardMaterial;
    selection: THREE.Mesh;
    activeRing: THREE.Mesh;
    robot: THREE.Group;
    sign: THREE.Sprite;
    label: HTMLCanvasElement;
    texture: THREE.CanvasTexture;
    labelKey: string;
    entrance: THREE.Vector3;
  };
  const stations: Station[] = [];

  function makeRobot(paint: THREE.Material) {
    const robot = new THREE.Group();
    box(0.3, 0.36, 0.25, paint, 0, 0.4, 0, robot, 0.07);
    box(0.38, 0.27, 0.29, chalk, 0, 0.74, 0, robot, 0.07);
    box(0.26, 0.12, 0.015, graphite, 0, 0.75, 0.15, robot, 0.02);
    for (const x of [-0.075, 0.075]) {
      box(0.035, 0.04, 0.015, lampPaint, x, 0.76, 0.16, robot, 0.008);
      box(0.08, 0.18, 0.12, graphite, x, 0.14, 0, robot, 0.02);
    }
    for (const x of [-0.21, 0.21]) box(0.08, 0.25, 0.09, metal, x, 0.42, 0, robot, 0.03);
    cylinder(0.018, 0.12, graphite, 0, 0.94, 0, robot, 6);
    sphere(0.04, paint, 0, 1.02, 0, robot);
    return robot;
  }

  for (const [index, district] of DISTRICTS.entries()) {
    const { x, z, id, height } = district;
    const group = new THREE.Group();
    group.position.set(x, 0.11, z);
    group.rotation.y = Math.atan2(-x, -z);
    group.userData.stage = id;
    scene.add(group);
    clickable.push(group);
    const paint = material(district.color);
    box(3.65, 0.15, 3.2, chalk, 0, 0.12, 0, group, 0.12);
    box(1.25, 0.1, 0.6, concrete, 0, 0.17, 1.85, group);
    box(0.9, 0.1, 0.45, chalk, 0, 0.23, 1.6, group);
    const indicator = material(STATUS.idle.color, 0.4);
    indicator.emissive.set(STATUS.idle.color);
    sphere(0.09, indicator, 1.48, 0.38, 1.27, group, 2);
    box(0.48, 0.035, 0.035, paint, -1.05, 0.21, 1.42, group);

    if (id === "pm") {
      box(2.8, 1.65, 2.25, chalk, 0, 1.02, 0, group);
      const roof = mesh(new THREE.ConeGeometry(2.1, 0.95, 4), paint, 0, 2.28, 0, group);
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 0.83;
      box(0.3, 0.78, 0.32, graphite, 0.85, 2.65, -0.35, group);
      box(0.43, 0.12, 0.43, chalk, 0.85, 3.02, -0.35, group);
      for (const wx of [-0.85, 0.85]) {
        box(0.55, 0.75, 0.08, paint, wx, 1.12, 1.16, group);
        box(0.4, 0.57, 0.1, windows, wx, 1.16, 1.2, group);
        box(0.6, 0.1, 0.24, concrete, wx, 0.72, 1.25, group);
      }
      box(0.48, 1.08, 0.06, timber, 0, 0.76, 1.16, group);
      box(1.05, 0.09, 0.6, paint, 0, 1.55, 1.35, group);
    } else if (id === "architect") {
      box(2.9, 1.3, 2.3, chalk, 0, 0.88, 0, group);
      box(1.9, 1.15, 1.65, chalk, -0.35, 2.05, -0.12, group);
      box(3.15, 0.17, 2.55, paint, 0, 1.62, 0, group);
      box(2.1, 0.16, 1.8, paint, -0.35, 2.7, -0.12, group);
      box(2.65, 0.85, 0.06, windows, 0, 1, 1.19, group);
      for (let i = 0; i < 6; i++) box(0.055, 0.91, 0.08, chalk, -1.2 + i * 0.48, 1, 1.23, group);
      box(1.63, 0.6, 0.04, darkGlass, -0.35, 2.12, 0.73, group);
      for (const wx of [-0.9, -0.35, 0.2]) box(0.035, 0.65, 0.05, metal, wx, 2.12, 0.76, group);
      const skylight = box(1.35, 0.12, 0.85, windows, -0.35, 2.86, -0.12, group);
      skylight.rotation.x = -0.14;
      box(0.12, 1.1, 0.12, metal, 1.3, 2.18, -0.8, group);
      box(1.05, 0.09, 0.12, metal, 0.85, 2.7, -0.8, group);
    } else if (id === "coder") {
      box(2.7, 2.65, 2.2, graphite, 0, 1.53, 0, group, 0.1);
      box(2.95, 0.18, 2.4, paint, 0, 2.9, 0, group);
      for (const wx of [-1.05, 0, 1.05]) box(0.16, 2.1, 0.04, windows, wx, 1.6, 1.12, group);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) box(0.045, 0.12, 1.7, paint, side * 1.37, 0.9 + i * 0.47, 0, group);
      }
      box(1.85, 1.05, 0.2, metal, 0, 3.52, 0, group, 0.1);
      box(1.65, 0.82, 0.05, darkGlass, 0, 3.52, 0.13, group, 0.04);
      for (let i = 0; i < 4; i++) box(0.6 + (i % 2) * 0.4, 0.045, 0.03, paint, -0.15 + (i % 2) * 0.1, 3.77 - i * 0.16, 0.17, group, 0.01);
      box(0.28, 0.45, 0.25, graphite, 0, 3.04, 0, group);
      box(0.52, 1.05, 0.05, darkGlass, 0, 0.8, 1.15, group);
    } else if (id === "reviewer") {
      box(2.9, 1.7, 2.2, pearl, 0, 1.05, 0, group);
      box(3.2, 0.24, 2.55, paint, 0, 2.03, 0, group);
      box(2.4, 0.25, 1.8, chalk, 0, 2.26, 0, group);
      for (const wx of [-1.1, -0.55, 0.55, 1.1]) {
        cylinder(0.09, 1.5, chalk, wx, 1.02, 1.25, group, 12);
        box(0.28, 0.12, 0.3, paint, wx, 0.3, 1.25, group);
      }
      box(2.45, 1.15, 0.07, darkGlass, 0, 1.07, 1.12, group);
      const arch = mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 24, Math.PI), paint, 0, 2.6, 0, group);
      arch.rotation.y = 0;
      box(0.1, 0.36, 0.1, metal, -0.55, 2.43, 0, group);
      box(0.1, 0.36, 0.1, metal, 0.55, 2.43, 0, group);
      sphere(0.13, amber, 0, 2.8, 0, group, 2);
    } else if (id === "tester") {
      box(2.9, 1.65, 2.2, chalk, 0, 1.02, 0, group);
      box(3.12, 0.16, 2.4, paint, 0, 1.94, 0, group);
      for (const wx of [-0.78, 0.78]) {
        cylinder(0.38, 0.95, concrete, wx, 2.44, 0, group);
        cylinder(0.39, 0.1, paint, wx, 2.94, 0, group);
        cylinder(0.26, 0.34, windows, wx, 2.67, 0, group);
        cylinder(0.12, 0.25, metal, wx, 3.1, 0, group);
      }
      for (const wx of [-0.97, 0, 0.97]) box(0.61, 0.77, 0.07, windows, wx, 1.2, 1.15, group);
      box(2.8, 0.12, 0.11, paint, 0, 0.65, 1.21, group);
      box(0.48, 0.94, 0.08, darkGlass, 0, 0.7, 1.22, group);
      for (let i = 0; i < 3; i++) box(0.24, 0.1, 0.22, paint, 1.52, 0.3 + i * 0.13, -0.9, group);
    } else {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          box(1.32, 0.95, 2.1, row ? chalk : paint, -0.72 + col * 1.44, 0.75 + row * 1.02, row * -0.17, group, 0.07);
          for (let i = 0; i < 5; i++) box(0.035, 0.71, 0.035, row ? concrete : metal, -1.19 + col * 1.44 + i * 0.23, 0.75 + row * 1.02, 1.07 - row * 0.17, group, 0.008);
          box(0.025, 0.64, 1.72, metal, -1.4 + col * 2.8, 0.75 + row * 1.02, -row * 0.17, group, 0.008);
        }
      }
      box(3.05, 0.17, 2.4, graphite, 0, 2.32, -0.1, group);
      box(1.8, 0.4, 1.25, paint, -0.35, 2.6, -0.2, group);
      for (let i = 0; i < 3; i++) box(0.28, 0.025, 0.85, darkGlass, -0.95 + i * 0.55, 2.82, -0.2, group);
    }

    const entrance = new THREE.Vector3(x * 0.66, 0.17, z * 0.66);
    const robot = makeRobot(paint);
    robot.position.copy(entrance).add(new THREE.Vector3(-0.48, 0, 0.2));
    robot.rotation.y = group.rotation.y;
    scene.add(robot);
    const selectedPaint = new THREE.MeshBasicMaterial({ color: district.color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    const activePaint = new THREE.MeshBasicMaterial({ color: district.color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    materials.add(selectedPaint); materials.add(activePaint);
    const selection = ring(2.35, 0.04, selectedPaint, x, 0.15, z);
    const activeRing = ring(2.52, 0.08, activePaint, x, 0.145, z);
    const label = document.createElement("canvas");
    label.width = 576; label.height = 164;
    const texture = new THREE.CanvasTexture(label);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    textures.add(texture);
    const signPaint = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false });
    materials.add(signPaint);
    const sign = new THREE.Sprite(signPaint);
    sign.position.set(x, height + 1.08, z);
    sign.scale.set(3.9, 1.11, 1);
    sign.renderOrder = 4;
    sign.userData.stage = id;
    scene.add(sign);
    clickable.push(sign);
    stations.push({ id, group, indicator, selection, activeRing, robot, sign, label, texture, labelKey: "", entrance });

    const plaque = box(0.34, 0.5, 0.06, graphite, -1.45, 0.65, 1.5, group);
    plaque.userData.stage = id;
    for (let n = 0; n <= index; n++) box(0.025, 0.05, 0.012, chalk, -1.56 + (n % 3) * 0.1, 0.73 - Math.floor(n / 3) * 0.13, 1.538, group, 0.004);
    consolidate(group);
  }

  function tree(x: number, z: number, size: number, tall: boolean) {
    cylinder(0.55 * size, 0.12, concrete, x, 0.17, z, scene, 16);
    cylinder(0.46 * size, 0.04, soil, x, 0.25, z, scene, 16);
    cylinder(0.065 * size, 0.9 * size, timber, x, 0.6 * size, z, scene, 8);
    const crown = sphere(0.62 * size, tall ? green : lightGreen, x, 1.28 * size, z, scene, 2);
    if (tall) crown.scale.set(0.7, 1.5, 0.7);
    else sphere(0.43 * size, green, x + 0.2 * size, 1.1 * size, z + 0.2 * size, scene, 1);
  }
  [[-9.2, -0.4], [-8.9, -1.8], [-4.1, -8.1], [-2.7, -9], [4, -8.2], [8.7, -0.1], [9.2, 1.5], [4.3, 7.8], [2.8, 9], [-3.5, 8.5], [-8.5, 5.8]].forEach(([x, z], i) => tree(x, z, 0.8 + (i % 3) * 0.12, i % 3 !== 0));
  for (const [x, z, angle] of [[-2.4, -2.1, -0.6], [2.7, 1.8, -0.6], [-2.1, 2.8, 0.7]]) {
    const bench = new THREE.Group();
    bench.position.set(x, 0.16, z); bench.rotation.y = angle; scene.add(bench);
    for (let i = 0; i < 3; i++) box(1.15, 0.07, 0.11, timber, 0, 0.43, -0.13 + i * 0.13, bench, 0.02);
    box(1.15, 0.25, 0.075, timber, 0, 0.68, -0.23, bench, 0.02);
    for (const wx of [-0.43, 0.43]) box(0.07, 0.38, 0.42, graphite, wx, 0.23, 0, bench, 0.02);
  }
  for (const [x, z] of [[-3.5, 0], [3.5, -0.5], [0.8, -3.1], [-0.9, 3.4]]) {
    cylinder(0.6, 0.12, concrete, x, 0.16, z, scene, 32);
    cylinder(0.52, 0.09, lawn, x, 0.26, z, scene, 32);
    sphere(0.29, green, x - 0.16, 0.48, z);
    sphere(0.24, lightGreen, x + 0.2, 0.43, z + 0.12);
  }
  for (let i = 0; i < 9; i++) {
    const angle = i / 9 * Math.PI * 2 + 0.15;
    const x = Math.cos(angle) * 9.95, z = Math.sin(angle) * 9.95;
    cylinder(0.035, 1.25, graphite, x, 0.7, z, scene, 8);
    cylinder(0.13, 0.15, lampPaint, x, 1.37, z, scene, 12);
    cylinder(0.17, 0.055, graphite, x, 1.47, z, scene, 12);
  }
  // A signal travels only when the recorded pipeline hands work to another stage.
  const courier = new THREE.Group();
  box(0.35, 0.4, 0.3, chalk, 0, 0, 0, courier, 0.07);
  box(0.22, 0.045, 0.03, amber, 0, 0.07, 0.16, courier, 0.008);
  box(0.15, 0.035, 0.03, amber, -0.03, -0.04, 0.16, courier, 0.008);
  const courierRing = mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 24), amber, 0, 0, 0, courier);
  courierRing.rotation.x = Math.PI / 2;
  courier.visible = false;
  scene.add(courier);
  const routePaint = new THREE.MeshBasicMaterial({ color: "#d7aa6a", transparent: true, opacity: 0.72, depthWrite: false });
  materials.add(routePaint);
  let routeMesh: THREE.Mesh | null = null;
  const travelPoint = new THREE.Vector3();
  const travelTangent = new THREE.Vector3();

  function drawLabel(station: Station) {
    const agent = state.snapshot.agents[station.id];
    const awaiting = state.snapshot.approval?.phase === station.id;
    const selected = state.selected === station.id;
    const key = `${agent.state}:${agent.iteration}:${awaiting}:${selected}:${state.night}`;
    if (station.labelKey === key) return;
    station.labelKey = key;
    const ctx = station.label.getContext("2d");
    if (!ctx) return;
    const district = DISTRICTS.find(d => d.id === station.id)!;
    ctx.clearRect(0, 0, 576, 164);
    ctx.fillStyle = state.night ? "#1c2027" : "#ffffff";
    ctx.beginPath(); ctx.roundRect(5, 5, 566, 154, 24); ctx.fill();
    ctx.lineWidth = selected ? 4 : 1.5;
    ctx.strokeStyle = selected ? state.night ? "#9aa1ab" : "#535c6b" : state.night ? "#3a414b" : "#d7dce4";
    ctx.stroke();
    ctx.fillStyle = awaiting ? "#d9aa66" : STATUS[agent.state].color;
    ctx.beginPath(); ctx.arc(45, 59, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = state.night ? "#f1f3f5" : "#171717";
    ctx.font = "650 42px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(PIPELINE_STAGES.find(s => s.id === station.id)!.name, 73, 60);
    ctx.fillStyle = state.night ? "#b4bbc7" : "#575f6c";
    ctx.font = "500 27px -apple-system, BlinkMacSystemFont, sans-serif";
    const status = awaiting ? "Approval needed" : STATUS[agent.state].text;
    ctx.fillText(`${status}${agent.iteration > 0 ? ` · Pass ${agent.iteration + 1}` : ""}`, 73, 113);
    ctx.fillStyle = district.color;
    ctx.font = "500 23px ui-monospace, monospace";
    ctx.fillText(`0${DISTRICTS.findIndex(d => d.id === station.id) + 1}`, 510, 59);
    station.texture.needsUpdate = true;
  }

  function applyState() {
    scene.background = new THREE.Color(state.night ? "#131820" : "#edf0f5");
    groundPaint.color.set(state.night ? "#1c222c" : "#edf0f5");
    ambient.intensity = state.night ? 1.1 : 2.1;
    ambient.color.set(state.night ? "#adc0e2" : "#ffffff");
    ambient.groundColor.set(state.night ? "#30394b" : "#8e9aaf");
    sun.intensity = state.night ? 1.2 : 3.1;
    sun.color.set(state.night ? "#c3d2f2" : "#fff8f0");
    fill.intensity = state.night ? 1.35 : 0.85;
    lampPaint.emissiveIntensity = state.night ? 2.1 : 0.05;
    windows.emissive.set(state.night ? "#d9c99b" : "#000000");
    windows.emissiveIntensity = state.night ? 0.48 : 0;
    renderer.toneMappingExposure = state.night ? 1.08 : 1;
    if (travel) routePaint.color.set(travel.repair ? state.night ? "#b794ff" : "#6d28d9" : "#8c9fb9");
    const centerColor = state.snapshot.status === "succeeded" ? "#7fa99a" : state.snapshot.status.startsWith("failed") ? "#d68380" : state.snapshot.approval ? "#d9aa66" : activeStage(state.snapshot) ? "#d4ac70" : "#89908e";
    centerStatus.color.set(centerColor);
    centerStatus.emissive.set(centerColor);
    centerStatus.emissiveIntensity = state.night ? 0.6 : 0.15;
    for (const station of stations) {
      const status = state.snapshot.agents[station.id].state;
      const color = state.snapshot.approval?.phase === station.id ? "#d9aa66" : STATUS[status].color;
      station.indicator.color.set(color);
      station.indicator.emissive.set(color);
      station.indicator.emissiveIntensity = status === "working" ? 0.7 : state.night ? 0.35 : 0.08;
      station.selection.visible = state.selected === station.id;
      station.activeRing.visible = status === "working" || state.snapshot.approval?.phase === station.id;
      station.activeRing.scale.setScalar(1);
      station.robot.position.y = station.entrance.y;
      drawLabel(station);
    }
    renderer.shadowMap.needsUpdate = true;
    requestDraw();
  }

  function beginTravel(from: PipelineStageId, to: PipelineStageId, repair: boolean) {
    if (from === to) return;
    const source = stations.find(s => s.id === from)!.entrance.clone().setY(1);
    const end = stations.find(s => s.id === to)!.entrance.clone().setY(1);
    const midpoint = source.clone().add(end).multiplyScalar(0.5);
    if (repair) {
      const direction = source.clone().sub(end).normalize();
      midpoint.add(new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(3));
      midpoint.y = 3.8;
    } else midpoint.multiplyScalar(0.72).setY(1.45);
    const curve = new THREE.CatmullRomCurve3([source, midpoint, end]);
    if (routeMesh) {
      scene.remove(routeMesh);
      geometries.delete(routeMesh.geometry);
      routeMesh.geometry.dispose();
    }
    routePaint.color.set(repair ? state.night ? "#b794ff" : "#6d28d9" : "#8c9fb9");
    routeMesh = mesh(new THREE.TubeGeometry(curve, 48, repair ? 0.035 : 0.02, 6, false), routePaint, 0, 0, 0);
    routeMesh.castShadow = false;
    routeMesh.visible = true;
    travel = { curve, elapsed: 0, repair };
    courier.visible = !state.reducedMotion;
    courier.position.copy(source);
    requestDraw();
  }

  function updateCamera() {
    camera.position.setFromSpherical(orbit).add(lookAt);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
  }
  function resize() {
    if (disposed) return;
    const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
    const aspect = width / height;
    const halfHeight = Math.max(11.4, 14.3 / aspect) / zoomFactor;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    requestDraw();
  }
  function focus(stage: PipelineStageId | null) {
    const district = DISTRICTS.find(d => d.id === stage);
    wantedLookAt.set(district ? district.x * 0.12 : 0, 0.8, district ? district.z * 0.12 : 0);
    if (state.reducedMotion || state.paused) lookAt.copy(wantedLookAt);
    requestDraw();
  }
  function zoom(amount: number) {
    zoomFactor = THREE.MathUtils.clamp(zoomFactor + amount, 0.72, 1.85);
    resize();
  }
  function resetView() {
    orbit.copy(homeOrbit); zoomFactor = 1;
    wantedLookAt.set(0, 0.8, 0); lookAt.copy(wantedLookAt);
    resize();
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function hit(event: PointerEvent) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const intersection of raycaster.intersectObjects(clickable, true)) {
      let current: THREE.Object3D | null = intersection.object;
      while (current) {
        if (current.userData.stage) { onSelect(current.userData.stage as PipelineStageId); return; }
        current = current.parent;
      }
    }
  }
  function cancelGesture() {
    if (gesture && canvas.hasPointerCapture(gesture.id)) canvas.releasePointerCapture(gesture.id);
    gesture = null;
    canvas.style.cursor = "grab";
  }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || gesture) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, theta: orbit.theta, phi: orbit.phi, moved: false, touch: event.pointerType === "touch" };
    canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
    gesture.moved = true;
    canvas.style.cursor = "grabbing";
    orbit.theta = gesture.theta - dx * 0.005;
    if (!gesture.touch) orbit.phi = THREE.MathUtils.clamp(gesture.phi - dy * 0.004, 0.47, 1.16);
    requestDraw();
  }
  function pointerUp(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId) return;
    pointerMove(event);
    const clicked = !gesture?.moved;
    cancelGesture();
    if (clicked) hit(event);
  }
  function pointerCancel(event: PointerEvent) {
    if (gesture?.id === event.pointerId) cancelGesture();
  }
  function wheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoom(-event.deltaY * 0.002);
  }
  function keyDown(event: KeyboardEvent) {
    if (event.key === "+" || event.key === "=") zoom(0.1);
    else if (event.key === "-") zoom(-0.1);
    else if (event.key === "0" || event.key === "Home") resetView();
    else if (event.key === "ArrowLeft") { orbit.theta += 0.12; requestDraw(); }
    else if (event.key === "ArrowRight") { orbit.theta -= 0.12; requestDraw(); }
    else if (event.key === "ArrowUp") { orbit.phi = Math.max(0.47, orbit.phi - 0.08); requestDraw(); }
    else if (event.key === "ArrowDown") { orbit.phi = Math.min(1.16, orbit.phi + 0.08); requestDraw(); }
    else return;
    event.preventDefault();
  }
  function canAnimate() { return !state.paused && !state.reducedMotion; }
  function needsAnimation() {
    return canAnimate() && (Boolean(activeStage(state.snapshot)) || Boolean(travel) || lookAt.distanceToSquared(wantedLookAt) > 0.0001);
  }
  function draw(now: number) {
    frame = 0;
    if (disposed || !visible || document.hidden || contextLost) { lastFrame = 0; return; }
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
    if (!dirty && lastFrame && now - lastFrame < 32) { frame = requestAnimationFrame(draw); return; }
    lastFrame = now;
    if (canAnimate()) {
      time += delta;
      lookAt.lerp(wantedLookAt, 0.09);
      const working = activeStage(state.snapshot);
      if (working) {
        core.rotation.y = time * 0.12;
        for (const station of stations) {
          if (state.snapshot.agents[station.id].state !== "working") continue;
          station.robot.position.y = station.entrance.y + Math.sin(time * 2.2) * 0.045;
          station.activeRing.scale.setScalar(1 + Math.sin(time * 1.7) * 0.025);
        }
      }
      if (travel) {
        travel.elapsed += delta;
        const duration = travel.repair ? 3.2 : 2.1;
        const progress = Math.min(travel.elapsed / duration, 1);
        travel.curve.getPoint(progress, travelPoint);
        travel.curve.getTangent(progress, travelTangent);
        courier.position.copy(travelPoint);
        courier.rotation.y = Math.atan2(travelTangent.x, travelTangent.z);
        courierRing.rotation.z = time * 0.6;
        routePaint.opacity = progress > 0.8 ? Math.max(0.1, (1 - progress) * 3.6) : 0.72;
        if (travel.elapsed > duration + 0.5) {
          travel = null; courier.visible = false;
          if (routeMesh) routeMesh.visible = false;
        }
      }
    }
    updateCamera();
    renderer.render(scene, camera);
    dirty = false;
    if (needsAnimation()) frame = requestAnimationFrame(draw);
  }
  function requestDraw() {
    dirty = true;
    if (!frame && !disposed && visible && !document.hidden && !contextLost) frame = requestAnimationFrame(draw);
  }
  function visibilityChanged() {
    lastFrame = 0;
    if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; }
    else requestDraw();
  }
  function lost(event: Event) { event.preventDefault(); contextLost = true; if (frame) cancelAnimationFrame(frame); frame = 0; }
  function restored() { contextLost = false; renderer.shadowMap.needsUpdate = true; requestDraw(); }
  canvas.style.cursor = "grab";
  initializationCleanup.push(() => {
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.removeEventListener("pointermove", pointerMove);
    canvas.removeEventListener("pointerup", pointerUp);
    canvas.removeEventListener("pointercancel", pointerCancel);
    canvas.removeEventListener("lostpointercapture", pointerCancel);
    canvas.removeEventListener("wheel", wheel);
    canvas.removeEventListener("keydown", keyDown);
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
    document.removeEventListener("visibilitychange", visibilityChanged);
  });
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerCancel);
  canvas.addEventListener("lostpointercapture", pointerCancel);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", keyDown);
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  document.addEventListener("visibilitychange", visibilityChanged);
  const resizeObserver = new ResizeObserver(resize);
  initializationCleanup.push(() => resizeObserver.disconnect());
  resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    lastFrame = 0;
    if (!visible) { if (frame) cancelAnimationFrame(frame); frame = 0; }
    else requestDraw();
  }, { rootMargin: "80px" });
  initializationCleanup.push(() => intersectionObserver.disconnect());
  intersectionObserver.observe(host);
  if (initial.follow) focus(stageBefore);
  applyState();
  resize();

  return {
    update(next: LiveCityWorldState) {
      if (disposed) return;
      const previous = state;
      state = next;
      const active = activeStage(next.snapshot);
      const key = loopKey(next.snapshot);
      const changedRun = previous.snapshot.runId !== next.snapshot.runId;
      const rewound = Date.parse(next.snapshot.lastEventAt ?? "") < Date.parse(previous.snapshot.lastEventAt ?? "");
      // A static repair route remains legible with reduced motion, then clears
      // once execution moves beyond the Coder it was sent back to.
      if (travel?.repair && state.reducedMotion && active && active !== "coder" && active !== stageBefore) {
        travel = null;
        if (routeMesh) routeMesh.visible = false;
      }
      if (changedRun || rewound || (previous.snapshot.lastLoop && !next.snapshot.lastLoop)) {
        travel = null; courier.visible = false;
        if (routeMesh) routeMesh.visible = false;
      } else if (key && key !== loopBefore && next.snapshot.lastLoop) {
        beginTravel(next.snapshot.lastLoop.trigger === "reviewer" ? "reviewer" : "sandbox", "coder", true);
      } else if (active && stageBefore && active !== stageBefore && !travel?.repair) {
        beginTravel(stageBefore, active, false);
      }
      if (active) stageBefore = active;
      else if (changedRun || rewound) stageBefore = null;
      loopBefore = key;
      if (state.reducedMotion) courier.visible = false;
      else if (travel) courier.visible = true;
      if (state.follow && (!previous.follow || active !== activeStage(previous.snapshot))) focus(active);
      applyState();
    },
    resetView,
    focus,
    zoom,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      cancelGesture();
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerCancel);
      canvas.removeEventListener("lostpointercapture", pointerCancel);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keyDown);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      document.removeEventListener("visibilitychange", visibilityChanged);
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      textures.forEach(value => value.dispose());
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose(); renderer.forceContextLoss();
      canvas.remove();
    },
  };
  } catch (error) {
    initializationCleanup.forEach(cleanup => cleanup());
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
    renderer.dispose(); renderer.forceContextLoss();
    canvas.remove();
    throw error;
  }
}

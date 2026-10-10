import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { bugs, stations, type CitySnapshot } from "./city-data";

type Callbacks = { visit: (index: number) => void; collect: (index: number) => void; near: (index: number | null) => void; secret: () => void };

export function createCity(host: HTMLElement, initial: CitySnapshot, callbacks: Callbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute("aria-label", "Agent City. Use arrow keys or WASD to walk, E to talk, click a building, or drag to orbit the camera.");
  renderer.domElement.setAttribute("role", "application");
  renderer.domElement.tabIndex = 0;
  host.appendChild(renderer.domElement);
  let snapshot = initial;
  let disposed = false;
  let frame = 0;
  let visible = true;
  let lastTime = 0;
  let time = 0;
  let lastNear: number | null = null;
  const keys = new Set<string>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures: THREE.Texture[] = [];
  const clickable: THREE.Object3D[] = [];
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-16, 16, 12, -12, 0.1, 120);
  camera.position.set(22, 24, 27);
  camera.lookAt(0, 0, 0);
  let zoom = 1;
  const defaultOrbit = new THREE.Spherical().setFromVector3(camera.position);
  const orbit = defaultOrbit.clone();
  let gesture: { id: number; x: number; y: number; theta: number; phi: number; dragged: boolean } | null = null;
  function updateCamera() {
    camera.position.setFromSpherical(orbit);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    requestDraw();
  }
  function cancelGesture() {
    const id = gesture?.id;
    gesture = null;
    delete renderer.domElement.dataset.dragging;
    if (id !== undefined && renderer.domElement.hasPointerCapture(id)) renderer.domElement.releasePointerCapture(id);
  }
  function pointerDown(event: PointerEvent) {
    if (snapshot.paused || event.button !== 0 || gesture) return;
    renderer.domElement.focus({ preventScroll: true });
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, theta: orbit.theta, phi: orbit.phi, dragged: false };
    renderer.domElement.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragged && Math.hypot(dx, dy) < 6) return;
    gesture.dragged = true;
    renderer.domElement.dataset.dragging = "true";
    orbit.theta = gesture.theta - dx * 0.006;
    orbit.phi = THREE.MathUtils.clamp(gesture.phi - dy * 0.006, 0.35, 1.25);
    updateCamera();
  }
  function pointerUp(event: PointerEvent) {
    if (!gesture || gesture.id !== event.pointerId) return;
    pointerMove(event);
    const clicked = !gesture.dragged;
    cancelGesture();
    if (clicked) onPointer(event);
  }
  function pointerCancel(event: PointerEvent) {
    if (gesture?.id === event.pointerId) cancelGesture();
  }
  const ambient = new THREE.HemisphereLight(0xfff6df, 0x6d8068, 2.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffefce, 3.4);
  sun.position.set(-12, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.06;
  scene.add(sun);

  const mat = (color: THREE.ColorRepresentation, roughness = 0.8) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness });
    materials.add(material);
    return material;
  };
  const cream = mat(0xf5ecd4), wall = mat(0xe3d5b5), stone = mat(0xb5bea0), wood = mat(0x805b43), dark = mat(0x35494c);
  const leaf = mat(0x6c956b), leafLight = mat(0x90ad77), grass = mat(0xa8b993), path = mat(0xe1d6b9), skin = mat(0xf4c89e);
  const teal = mat(0x488d88), yellow = mat(0xe6ae4e);
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x86aeb2, emissive: 0xf4c374, emissiveIntensity: 0 });
  materials.add(windowMat);
  const mesh = <T extends THREE.BufferGeometry>(geometry: T, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true; object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, r = 0.06) => mesh(new RoundedBoxGeometry(w, h, d, 1, r), material, x, y, z, parent);
  const sphere = (r: number, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => mesh(new THREE.IcosahedronGeometry(r, 1), material, x, y, z, parent);
  const cylinder = (top: number, bottom: number, h: number, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene, sides = 12) => mesh(new THREE.CylinderGeometry(top, bottom, h, sides), material, x, y, z, parent);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(0xb6d7d2));
  geometries.add(sea.geometry);
  sea.rotation.x = -Math.PI / 2; sea.position.y = -2.1; sea.receiveShadow = true; scene.add(sea);
  cylinder(11.9, 10.6, 1.9, stone, 0, -1, 0, scene, 8);
  cylinder(11.85, 11.85, 0.12, grass, 0, 0, 0, scene, 8);
  cylinder(2.25, 2.25, 0.06, path, 0, 0.1, 0, scene, 48);
  cylinder(0.75, 0.9, 0.35, cream, 0, 0.24, 0);
  cylinder(0.58, 0.58, 0.1, teal, 0, 0.46, 0);
  const idea = box(0.42, 0.42, 0.42, yellow, 0, 1.25, 0);
  const beacon = mesh(new THREE.TorusGeometry(0.7, 0.025, 6, 40), yellow, 0, 0.7, 0);
  beacon.rotation.x = Math.PI / 2;
  const entrances = stations.map(s => new THREE.Vector3(s.x * 0.66, 0, s.z * 0.66));
  const buildingGroups: THREE.Group[] = [];
  const signs: THREE.Sprite[] = [];
  const lights: THREE.Mesh[] = [];

  function label(text: string, color: string, x: number, y: number, z: number, station?: number) {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fffdf3"; ctx.beginPath(); ctx.roundRect(4, 4, 504, 120, 30); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(50, 64, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#35494c"; ctx.font = "600 43px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 280, 66);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false }); materials.add(material);
    const sprite = new THREE.Sprite(material); sprite.position.set(x, y, z); sprite.scale.set(3.1, 0.78, 1); sprite.renderOrder = 3; scene.add(sprite);
    if (station !== undefined) { sprite.userData.station = station; clickable.push(sprite); signs.push(sprite); }
    return sprite;
  }

  stations.forEach((station, index) => {
    const entry = entrances[index];
    const length = entry.length();
    const road = box(1.2, 0.05, length, path, entry.x / 2, 0.09, entry.z / 2);
    road.rotation.y = Math.atan2(entry.x, entry.z);
    for (let j = 1; j < length / 0.7; j++) {
      const t = j * 0.7 / length;
      const step = box(0.65, 0.025, 0.12, cream, entry.x * t, 0.13, entry.z * t);
      step.rotation.y = road.rotation.y;
    }
    const group = new THREE.Group(); group.position.set(station.x, 0, station.z);
    group.rotation.y = Math.atan2(-station.x, -station.z);
    group.userData.station = index; scene.add(group); buildingGroups.push(group);
    const paint = mat(station.color);
    box(3.5, 0.2, 2.9, cream, 0, 0.16, 0, group);
    box(2.8, 1.65, 2.15, wall, 0, 1.06, 0, group);
    box(3.1, 0.2, 2.5, paint, 0, 1.98, 0, group);
    box(0.65, 1.1, 0.06, dark, 0, 0.8, 1.1, group);
    box(0.12, 0.12, 0.1, yellow, 0.19, 0.72, 1.17, group);
    for (const x of [-0.95, 0.95]) {
      box(0.55, 0.65, 0.08, cream, x, 1.1, 1.12, group);
      box(0.43, 0.52, 0.08, windowMat, x, 1.1, 1.18, group);
      box(0.55, 0.1, 0.2, paint, x, 0.76, 1.22, group);
    }
    for (const side of [-1, 1]) box(0.08, 0.6, 0.65, windowMat, side * 1.44, 1.14, 0, group);
    box(1.1, 0.13, 0.48, cream, 0, 0.2, 1.5, group);
    box(1.5, 0.12, 0.6, paint, 0, 1.58, 1.35, group);
    const statusLight = sphere(0.12, paint, 0, 2.3, 0, group); lights.push(statusLight);
    if (index === 0) {
      const roof = mesh(new THREE.ConeGeometry(2.15, 1.0, 4), paint, 0, 2.4, 0, group); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.82;
      box(0.35, 0.8, 0.35, cream, 0.8, 2.75, -0.2, group);
      box(0.7, 0.8, 0.05, cream, -0.9, 1.15, 1.25, group);
    } else if (index === 1) {
      box(2.5, 0.14, 1.9, dark, 0, 2.2, 0, group);
      for (let j = 0; j < 4; j++) box(0.025, 0.04, 1.6, paint, -0.8 + j * 0.5, 2.3, 0, group);
      for (let j = 0; j < 3; j++) box(2.1, 0.04, 0.025, paint, 0, 2.3, -0.5 + j * 0.5, group);
      box(0.35, 0.75, 0.35, cream, 0.6, 2.6, 0.1, group);
    } else if (index === 2) {
      box(1.9, 0.9, 0.25, dark, 0, 2.6, 0, group);
      box(1.65, 0.65, 0.04, teal, 0, 2.6, 0.15, group);
      for (let j = 0; j < 3; j++) box(0.8 - j * 0.12, 0.04, 0.05, cream, -0.2, 2.75 - j * 0.15, 0.19, group);
      for (let j = 0; j < 3; j++) box(0.35, 0.35, 0.35, paint, 1.8, 0.3 + j * 0.36, 0, group);
    } else if (index === 3) {
      const arch = mesh(new THREE.TorusGeometry(0.7, 0.13, 6, 20, Math.PI), paint, 0, 2.35, 0, group);
      arch.rotation.y = 0;
      box(0.1, 0.55, 0.1, cream, -0.7, 2.1, 0, group); box(0.1, 0.55, 0.1, cream, 0.7, 2.1, 0, group);
    } else {
      for (const x of [-0.65, 0.65]) { cylinder(0.3, 0.3, 0.8, cream, x, 2.4, 0, group); sphere(0.35, paint, x, 2.88, 0, group); }
      const dish = mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint, 0, 2.1, -0.7, group); dish.rotation.x = -0.5;
    }
    label(station.name, station.color, station.x, 4.15, station.z, index);
    clickable.push(group);
    // A resident robot greets you beside each entrance.
    const bot = new THREE.Group(); bot.position.copy(entry); bot.position.x += 0.7;
    scene.add(bot);
    box(0.42, 0.5, 0.35, paint, 0, 0.55, 0, bot); box(0.48, 0.32, 0.4, cream, 0, 0.98, 0, bot);
    for (const x of [-0.12, 0.12]) { box(0.09, 0.09, 0.03, dark, x, 1, 0.21, bot); box(0.1, 0.22, 0.1, dark, x, 0.2, 0, bot); }
    cylinder(0.03, 0.03, 0.2, dark, 0, 1.22, 0, bot); sphere(0.06, paint, 0, 1.35, 0, bot);
  });

  // Small, deterministic details keep the island readable and reproducible.
  const treePoints = [[-8,-5],[-7,-7],[-4,-8],[6,-6],[8,-3],[8,2],[6,7],[0,9],[-7,7],[-9,3],[-9,-2],[0,-9]];
  treePoints.forEach(([x,z], i) => {
    cylinder(0.12, 0.2, 0.9, wood, x, 0.55, z);
    sphere(0.8 + (i % 3) * 0.1, i % 2 ? leaf : leafLight, x, 1.6, z);
    sphere(0.55, leaf, x + 0.35, 1.4, z + 0.2);
  });
  for (let i = 0; i < 32; i++) {
    const a = i * 2.39996, r = 8.9 + (i % 3) * 0.23;
    sphere(0.12, i % 3 ? cream : yellow, Math.cos(a)*r, 0.18, Math.sin(a)*r);
  }
  const bench = new THREE.Group(); bench.position.set(-2.9, 0, 2.6); bench.rotation.y = -0.5; scene.add(bench);
  box(1.4, 0.12, 0.5, wood, 0, 0.5, 0, bench); box(1.4, 0.35, 0.1, wood, 0, 0.8, -0.25, bench);
  for (const x of [-0.5,0.5]) box(0.12, 0.45, 0.35, dark, x, 0.25, 0, bench);
  const cup = cylinder(0.15, 0.12, 0.22, cream, 0.35, 0.68, 0, bench);
  cup.userData.secret = true; bench.userData.secret = true; clickable.push(bench);
  const coffeeSign = label("Coffee nook", "#b18463", -2.9, 1.75, 2.6);
  if (coffeeSign) coffeeSign.visible = initial.secret;
  if (coffeeSign) { coffeeSign.userData.secret = true; clickable.push(coffeeSign); }
  for (const [x,z] of [[-2,-2],[2,2],[-2,5],[4,-3]]) {
    cylinder(0.055, 0.08, 1.6, dark, x, 0.8, z);
    sphere(0.16, cream, x, 1.7, z);
  }
  // A little dock and a boat, away from the main paths.
  for (let i = 0; i < 7; i++) box(1.7, 0.1, 0.35, wood, -1.5, -0.9, 10.1 + i * 0.38);
  const boat = box(0.9, 0.32, 2, yellow, -3, -1.75, 11.7);
  box(0.75, 0.12, 1.4, dark, -3, -1.54, 11.7);
  const clouds: THREE.Group[] = [];
  [[-13,-8],[12,10],[-13,9]].forEach(([x,z]) => {
    const cloud = new THREE.Group(); cloud.position.set(x, 3.6, z); scene.add(cloud); clouds.push(cloud);
    sphere(0.7, cream, 0, 0, 0, cloud); sphere(1.1, cream, 0.9, 0.15, 0, cloud); sphere(0.7, cream, 1.9, 0, 0, cloud);
  });

  const bugMeshes = bugs.map((bug, index) => {
    const group = new THREE.Group(); group.position.set(bug.x, 0.28, bug.z); group.userData.bug = index; scene.add(group); clickable.push(group);
    sphere(0.24, index === 1 ? teal : mat(0x70526d), 0, 0.15, 0, group);
    sphere(0.16, dark, 0, 0.18, 0.24, group);
    for (const side of [-1,1]) for (let j = 0; j < 3; j++) { const leg = box(0.25, 0.035, 0.035, dark, side*0.25, 0.05, -0.1+j*0.15, group); leg.rotation.y = side * (j-1)*0.4; }
    sphere(0.045, cream, -0.07, 0.26, 0.35, group); sphere(0.045, cream, 0.07, 0.26, 0.35, group);
    return group;
  });
  const player = new THREE.Group(); player.position.set(0, 0.1, 2.2); scene.add(player);
  box(0.48, 0.53, 0.32, yellow, 0, 0.8, 0, player);
  box(0.4, 0.38, 0.37, skin, 0, 1.29, 0, player, 0.1);
  box(0.43, 0.16, 0.4, dark, 0, 1.5, -0.02, player, 0.06);
  box(0.34, 0.16, 0.12, dark, 0, 1.36, -0.2, player);
  const legs = [-1,1].map(side => box(0.17, 0.38, 0.19, dark, side*0.14, 0.32, 0, player));
  for (const side of [-1,1]) { box(0.15, 0.38, 0.17, yellow, side*0.33, 0.79, 0, player); box(0.15, 0.12, 0.16, skin, side*0.33, 0.54, 0, player); }
  box(0.34, 0.36, 0.15, teal, 0, 0.8, -0.25, player);
  for (const x of [-0.1,0.1]) box(0.06, 0.06, 0.025, dark, x, 1.29, 0.2, player);
  const carried = box(0.32, 0.32, 0.32, yellow, 0.45, 0.85, 0.28, player);
  const destination = mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 24), cream, 0, 0.16, 2.2); destination.rotation.x = -Math.PI / 2; destination.visible = false;
  const guide = mesh(new THREE.TorusGeometry(0.65, 0.06, 6, 36), yellow, 0, 0.16, 0); guide.rotation.x = -Math.PI / 2;
  // The environment is fixed; cache its shadows instead of redrawing them every frame.
  for (const object of [player, idea, beacon, destination, guide, boat, ...clouds, ...bugMeshes]) object.traverse(child => { child.castShadow = false; });
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), -0.1);
  const hitPoint = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const waypoints: THREE.Vector3[] = [];
  let pendingVisit: number | null = null;
  let pendingBug: number | null = null;
  let pendingSecret = false;

  function blocked(x: number, z: number) {
    if (Math.hypot(x,z) > 10) return true;
    return stations.some(s => Math.abs(x-s.x) < 1.8 && Math.abs(z-s.z) < 1.8);
  }
  function routeTo(point: THREE.Vector3) {
    waypoints.length = 0;
    // A small navigation grid routes around buildings instead of getting stuck behind them.
    const size = 41, step = 0.5;
    const open = new Uint8Array(size*size);
    const previous = new Int32Array(size*size).fill(-1);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) open[z*size+x] = blocked(x*step-10,z*step-10) ? 0 : 1;
    const nearest = (x: number,z: number) => {
      let best = -1, distance = Infinity;
      for (let i = 0; i < open.length; i++) {
        if (!open[i]) continue;
        const d = (i%size*step-10-x)**2 + (Math.floor(i/size)*step-10-z)**2;
        if (d < distance) { distance = d; best = i; }
      }
      return best;
    };
    const start = nearest(player.position.x,player.position.z), goal = nearest(point.x,point.z);
    if (start < 0 || goal < 0) return;
    const queue = [start]; previous[start] = start;
    const directions = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]];
    for (let head = 0; head < queue.length && previous[goal] < 0; head++) {
      const cell = queue[head], x = cell%size, z = Math.floor(cell/size);
      for (const [dx,dz] of directions) {
        const nx = x+dx, nz = z+dz, next = nz*size+nx;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size || !open[next] || previous[next] >= 0) continue;
        if (dx && dz && (!open[z*size+nx] || !open[nz*size+x])) continue;
        previous[next] = cell; queue.push(next);
      }
    }
    if (previous[goal] < 0) return;
    const cells: number[] = [];
    for (let cell = goal; cell !== start; cell = previous[cell]) cells.push(cell);
    cells.reverse();
    for (let i = 0; i < cells.length; i++) {
      if (i > 0 && i < cells.length-1 && cells[i]-cells[i-1] === cells[i+1]-cells[i]) continue;
      waypoints.push(new THREE.Vector3(cells[i]%size*step-10,0.1,Math.floor(cells[i]/size)*step-10));
    }
    if (!blocked(point.x,point.z)) waypoints.push(point.clone().setY(0.1));
    destination.position.copy(point).setY(0.17); destination.visible = true;
    requestDraw();
  }
  function visit(index: number) {
    pendingVisit = index; pendingBug = null; pendingSecret = false;
    routeTo(entrances[index]);
  }
  function interact() {
    if (snapshot.paused) return;
    if (lastNear !== null) callbacks.visit(lastNear);
  }
  function onPointer(event: PointerEvent) {
    if (snapshot.paused || event.button !== 0) return;
    renderer.domElement.focus({ preventScroll: true });
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits = raycaster.intersectObjects(clickable, true);
    if (hits.length) {
      let object: THREE.Object3D | null = hits[0].object;
      while (object) {
        if (typeof object.userData.station === "number") { visit(object.userData.station); return; }
        if (typeof object.userData.bug === "number") { pendingBug = object.userData.bug; pendingVisit = null; pendingSecret = false; routeTo(new THREE.Vector3(bugs[pendingBug].x,0,bugs[pendingBug].z)); return; }
        if (object.userData.secret) { pendingSecret = true; pendingBug = null; pendingVisit = null; routeTo(new THREE.Vector3(-2.9,0,3.3)); return; }
        object = object.parent;
      }
    }
    if (raycaster.ray.intersectPlane(groundPlane,hitPoint) && !blocked(hitPoint.x,hitPoint.z)) {
      pendingVisit = null; pendingBug = null; pendingSecret = false; routeTo(hitPoint);
    }
  }
  function onKey(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(key)) {
      event.preventDefault(); keys.add(key); waypoints.length = 0; pendingVisit = null; pendingBug = null; pendingSecret = false; requestDraw();
    }
    if (key === "e" && !event.repeat) interact();
  }
  function clearKeys() { keys.clear(); lastTime = 0; cancelGesture(); }
  function onKeyUp(event: KeyboardEvent) { keys.delete(event.key.toLowerCase()); }

  function draw(now: number) {
    frame = 0;
    if (disposed || !visible || document.hidden) { lastTime = 0; return; }
    const dt = lastTime ? Math.min((now-lastTime)/1000,0.05) : 0;
    lastTime = now;
    if (!snapshot.paused) time += dt;
    let walking = false;
    if (!snapshot.paused) {
      const horizontal = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
      const vertical = Number(keys.has("s") || keys.has("arrowdown")) - Number(keys.has("w") || keys.has("arrowup"));
      movement.set(horizontal*Math.cos(orbit.theta) + vertical*Math.sin(orbit.theta),0,-horizontal*Math.sin(orbit.theta) + vertical*Math.cos(orbit.theta));
      if (movement.lengthSq()) movement.normalize().multiplyScalar(4.8*dt);
      else if (waypoints.length) {
        movement.copy(waypoints[0]).sub(player.position).setY(0);
        if (movement.length() < 0.12) {
          waypoints.shift();
          if (!waypoints.length) {
            destination.visible = false;
            if (pendingVisit !== null) { callbacks.visit(pendingVisit); pendingVisit = null; }
            if (pendingBug !== null) { callbacks.collect(pendingBug); pendingBug = null; }
            if (pendingSecret) { callbacks.secret(); pendingSecret = false; }
          }
          movement.set(0,0,0);
        } else movement.multiplyScalar(Math.min(1,4.8*dt/movement.length()));
      }
      const nextX = player.position.x + movement.x, nextZ = player.position.z + movement.z;
      if (!blocked(nextX,nextZ) && movement.lengthSq()) {
        player.position.x = nextX; player.position.z = nextZ;
        player.rotation.y = Math.atan2(movement.x,movement.z); walking = true;
      } else if (movement.lengthSq() && waypoints.length) { waypoints.length = 0; destination.visible = false; }
      let near: number | null = null;
      for (let i = 0; i < entrances.length; i++) if (player.position.distanceTo(entrances[i]) < 1.8) { near = i; break; }
      if (near !== lastNear) { lastNear = near; callbacks.near(near); }
      for (let i = 0; i < bugMeshes.length; i++) if (!snapshot.collected.includes(i) && player.position.distanceTo(bugMeshes[i].position) < 0.8) callbacks.collect(i);
    }
    for (let i = 0; i < legs.length; i++) legs[i].rotation.x = walking && !snapshot.reducedMotion ? Math.sin(time*13+i*Math.PI)*0.6 : 0;
    if (!snapshot.reducedMotion && !snapshot.paused) {
      idea.rotation.y = time*0.6; idea.position.y = 1.25+Math.sin(time*2)*0.12;
      clouds.forEach((cloud,i) => { cloud.position.y = 3.6+Math.sin(time*0.3+i)*0.15; });
      boat.rotation.z = Math.sin(time)*0.025;
    }
    idea.visible = !snapshot.started;
    carried.visible = snapshot.started;
    guide.visible = !snapshot.started || snapshot.stage < 5;
    if (snapshot.started && snapshot.stage < 5) guide.position.copy(entrances[snapshot.stage]).setY(0.16);
    else guide.position.set(0,0.16,0);
    bugMeshes.forEach((bug,i) => { bug.visible = !snapshot.collected.includes(i); });
    if (coffeeSign) coffeeSign.visible = snapshot.secret;
    lights.forEach((light,i) => { light.scale.setScalar(i < snapshot.stage ? 1.4 : 1); });
    signs.forEach((sign,i) => { sign.material.opacity = !snapshot.started || i <= snapshot.stage ? 1 : 0.7; });
    renderer.render(scene,camera);
    if (!snapshot.paused && (!snapshot.reducedMotion || waypoints.length || keys.size)) frame = requestAnimationFrame(draw);
  }
  function requestDraw() { if (!disposed && !frame && visible && !document.hidden) frame = requestAnimationFrame(draw); }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    const aspect = width/height;
    const halfWidth = Math.max(15.2,aspect*10.8);
    camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfWidth/aspect; camera.bottom = -halfWidth/aspect;
    camera.zoom = zoom; camera.updateProjectionMatrix(); renderer.setSize(width,height); requestDraw();
  }
  function applyLighting() {
    const night = snapshot.night;
    renderer.setClearColor(night ? 0x253f4a : 0xb6d7d2);
    scene.background = new THREE.Color(night ? 0x253f4a : 0xb6d7d2);
    (sea.material as THREE.MeshStandardMaterial).color.set(night ? 0x294a55 : 0xb6d7d2);
    ambient.intensity = night ? 1.1 : 2.4; sun.intensity = night ? 0.8 : 3.4;
    sun.color.set(night ? 0xaacbff : 0xffefce); windowMat.emissiveIntensity = night ? 1.4 : 0;
  }
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) { cancelAnimationFrame(frame); frame = 0; clearKeys(); } else requestDraw(); }); observer.observe(host);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const onVisibility = () => { clearKeys(); requestDraw(); };
  renderer.domElement.addEventListener("pointerdown",pointerDown);
  renderer.domElement.addEventListener("pointermove",pointerMove);
  renderer.domElement.addEventListener("pointerup",pointerUp);
  renderer.domElement.addEventListener("pointercancel",pointerCancel);
  renderer.domElement.addEventListener("lostpointercapture",pointerCancel);
  renderer.domElement.addEventListener("keydown",onKey);
  renderer.domElement.addEventListener("keyup",onKeyUp);
  renderer.domElement.addEventListener("blur",clearKeys);
  document.addEventListener("visibilitychange",onVisibility);
  applyLighting(); resize();

  return {
    visit,
    interact,
    direction(key: string, pressed: boolean) { if (pressed) { keys.add(key); waypoints.length = 0; } else keys.delete(key); requestDraw(); },
    zoom(delta: number) { zoom = THREE.MathUtils.clamp(zoom+delta,0.8,1.5); resize(); },
    resetView() { cancelGesture(); orbit.copy(defaultOrbit); zoom = 1; camera.position.set(22,24,27); camera.lookAt(0,0,0); camera.updateMatrixWorld(); resize(); },
    update(next: CitySnapshot) { snapshot = next; if (snapshot.paused) clearKeys(); applyLighting(); requestDraw(); },
    reset() { player.position.set(0,0.1,2.2); waypoints.length = 0; pendingVisit = null; pendingBug = null; pendingSecret = false; keys.clear(); destination.visible = false; requestDraw(); },
    dispose() {
      disposed = true; cancelGesture(); cancelAnimationFrame(frame); observer.disconnect(); resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown",pointerDown);
      renderer.domElement.removeEventListener("pointermove",pointerMove);
      renderer.domElement.removeEventListener("pointerup",pointerUp);
      renderer.domElement.removeEventListener("pointercancel",pointerCancel);
      renderer.domElement.removeEventListener("lostpointercapture",pointerCancel); renderer.domElement.removeEventListener("keydown",onKey); renderer.domElement.removeEventListener("keyup",onKeyUp); renderer.domElement.removeEventListener("blur",clearKeys);
      document.removeEventListener("visibilitychange",onVisibility);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}

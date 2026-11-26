// CANYON GLIDER — the renderer. Three.js scene, chase camera, instanced
// canyon, pooled rings and particles. One job: turn the flight state and
// the world chunks into a picture, at 60 fps, with no per-frame allocation
// in the hot path. Low-poly flat shading, one palette per biome.
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { biomeAt } from './world.js';

const MAX_WALLS = 220;
const MAX_PILLARS = 140;
const MAX_MESAS = 80;
const RING_POOL = 32;
const PARTICLE_COUNT = 240;
const STREAK_COUNT = 46;

function buildGlider() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff7a3c, roughness: 0.55, metalness: 0.15, flatShading: true });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.6, metalness: 0.1, flatShading: true });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.5, metalness: 0.2, flatShading: true });

  // fuselage: nose cone + body, pointing +Z
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 8), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 2.1;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.32, 2.6, 8), bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.2;
  // canopy: a lit bubble the pilot sits under
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.15, metalness: 0.4, emissive: 0x155e75, emissiveIntensity: 0.5 }),
  );
  canopy.scale.set(1, 0.7, 1.6);
  canopy.position.set(0, 0.42, 0.9);
  // wings: wide, slightly swept, thin
  const wingGeo = new THREE.BoxGeometry(4.6, 0.09, 1.15);
  const wing = new THREE.Mesh(wingGeo, wingMat);
  wing.position.z = 0.1;
  // tail: stabiliser + fin
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.7), wingMat);
  tail.position.z = -1.25;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.8), accentMat);
  fin.position.set(0, 0.4, -1.25);
  // wingtip lights: tiny emissive dots, the "instruments lit" of the craft
  const tipMat = new THREE.MeshBasicMaterial({ color: 0x22ff88 });
  const tipL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), tipMat);
  tipL.position.set(-2.3, 0, 0.1);
  const tipR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  tipR.position.set(2.3, 0, 0.1);

  group.add(nose, body, canopy, wing, tail, fin, tipL, tipR);
  return group;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffd9a0);
  scene.fog = new THREE.Fog(0xf2b27a, 70, 340);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  const hemi = new THREE.HemisphereLight(0xfff2dd, 0xa06a45, 1.15);
  const sun = new THREE.DirectionalLight(0xffe0b3, 1.6);
  sun.position.set(-40, 90, -30);
  scene.add(hemi, sun);

  // canyon floor: one long plane that follows the glider
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 900, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xd99a68 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // instanced canyon: walls, pillars, mesas — one draw call each
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xc97a4e, flatShading: true });
  const walls = new THREE.InstancedMesh(boxGeo, wallMat, MAX_WALLS);
  walls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const pillarGeo = new THREE.CylinderGeometry(1, 1.25, 1, 8);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0xb06038, flatShading: true });
  const pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, MAX_PILLARS);
  pillars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const mesas = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xa06a45, flatShading: true }), MAX_MESAS);
  mesas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(walls, pillars, mesas);

  // ring pool: gold and green torus meshes, reused as chunks stream past
  const ringGeo = new THREE.TorusGeometry(C.ringRadius, 0.55, 10, 28);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.3, metalness: 0.6, emissive: 0xa16207, emissiveIntensity: 0.55 });
  const fuelMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.3, metalness: 0.6, emissive: 0x166534, emissiveIntensity: 0.55 });
  const ringPool = [];
  for (let i = 0; i < RING_POOL; i++) {
    const mesh = new THREE.Mesh(ringGeo, goldMat);
    mesh.visible = false;
    scene.add(mesh);
    ringPool.push(mesh);
  }

  // particles: one Points cloud, pooled, for ring bursts
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PARTICLE_COUNT * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffe08a, size: 0.9, transparent: true, opacity: 0.95 }));
  particles.frustumCulled = false;
  scene.add(particles);
  const pVel = new Float32Array(PARTICLE_COUNT * 3);
  const pLife = new Float32Array(PARTICLE_COUNT);

  // speed streaks: line segments rushing past when the glider is fast
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(STREAK_COUNT * 6);
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const streaks = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
  streaks.frustumCulled = false;
  scene.add(streaks);
  const streakData = [];
  for (let i = 0; i < STREAK_COUNT; i++) {
    streakData.push({ x: 0, y: 0, z: 0, len: 4 });
  }

  const glider = buildGlider();
  scene.add(glider);

  // storm lightning: a point light that flashes in the night biome
  const lightning = new THREE.PointLight(0xbfd0ff, 0, 400);
  lightning.position.set(0, 120, 120);
  scene.add(lightning);

  const dummy = new THREE.Object3D();
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3(0, 46, -12);
  let shake = 0;
  let fov = 62;
  let flash = 0;
  let nextFlash = 8;

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function spawnBurst(pos, colorHex) {
    particles.material.color.setHex(colorHex);
    let spawned = 0;
    for (let i = 0; i < PARTICLE_COUNT && spawned < 26; i++) {
      if (pLife[i] > 0) continue;
      pLife[i] = 0.7 + Math.random() * 0.5;
      pPos[i * 3] = pos.x;
      pPos[i * 3 + 1] = pos.y;
      pPos[i * 3 + 2] = pos.z;
      pVel[i * 3] = (Math.random() - 0.5) * 14;
      pVel[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pVel[i * 3 + 2] = (Math.random() - 0.5) * 14;
      spawned++;
    }
  }

  function setShake(amount) {
    shake = Math.max(shake, amount);
  }

  function setFlash(amount) {
    flash = Math.max(flash, amount);
  }

  // Sync the instanced canyon + ring pool to the chunks the world holds.
  function syncWorld(world, flight) {
    let wi = 0;
    let pi = 0;
    let mi = 0;
    let ri = 0;
    const chunks = [...world.chunks.values()].sort((a, b) => a.index - b.index);
    for (const chunk of chunks) {
      for (const w of chunk.walls) {
        if (wi >= MAX_WALLS) break;
        dummy.position.set(w.x, w.y, w.z);
        dummy.scale.set(w.w, w.h, w.d);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        walls.setMatrixAt(wi++, dummy.matrix);
      }
      for (const p of chunk.pillars) {
        if (pi >= MAX_PILLARS) break;
        dummy.position.set(p.x, p.h / 2, p.z);
        dummy.scale.set(p.r * 2, p.h, p.r * 2);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pillars.setMatrixAt(pi++, dummy.matrix);
      }
      for (const m of chunk.mesas) {
        if (mi >= MAX_MESAS) break;
        dummy.position.set(m.x, m.h / 2, m.z);
        dummy.scale.set(m.w, m.h, m.d);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesas.setMatrixAt(mi++, dummy.matrix);
      }
      for (const r of chunk.rings) {
        if (r.taken || ri >= RING_POOL) continue;
        const mesh = ringPool[ri++];
        mesh.visible = true;
        mesh.material = r.kind === 'fuel' ? fuelMat : goldMat;
        mesh.position.set(r.x, r.y, r.z);
        mesh.rotation.set(0, 0, 0);
      }
    }
    walls.count = wi;
    pillars.count = pi;
    mesas.count = mi;
    walls.instanceMatrix.needsUpdate = true;
    pillars.instanceMatrix.needsUpdate = true;
    mesas.instanceMatrix.needsUpdate = true;
    for (let i = ri; i < RING_POOL; i++) ringPool[i].visible = false;
    // floor follows the glider so the canyon never ends
    floor.position.set(flight.pos.x * 0.3, 0, flight.pos.z + 260);
  }

  function update(game, world, dt, time) {
    const f = game.flight;
    const biome = biomeAt(f.distance);
    // biome palette: lerp sky, fog and light toward the current biome
    const sky = new THREE.Color(biome.sky);
    const fog = new THREE.Color(biome.fog);
    scene.background.lerp(sky, 0.03);
    scene.fog.color.lerp(fog, 0.03);
    sun.color.lerp(new THREE.Color(biome.sun), 0.03);
    sun.intensity += ((biome.name === 'storm night' ? 0.7 : 1.6) - sun.intensity) * 0.03;
    hemi.intensity += ((biome.name === 'storm night' ? 0.45 : 0.95) - hemi.intensity) * 0.03;

    // storm lightning: random flashes in the night biome
    if (biome.name === 'storm night') {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flash = 1;
        nextFlash = 4 + Math.random() * 7;
      }
    }
    flash = Math.max(0, flash - dt * 2.2);
    lightning.intensity = flash * 900;

    syncWorld(world, f);

    // glider pose: bank into the turn, pitch with the nose. Note the signs:
    // the chase camera looks along +Z, so screen-right is world -X and a
    // right bank (roll > 0, which turns the glider right) reads as a
    // positive Z rotation — the right wing drops on screen.
    glider.position.set(f.pos.x, f.pos.y, f.pos.z);
    glider.rotation.set(-f.pitch, f.heading, f.roll, 'YXZ');

    // chase camera: behind and above, rolling with the bank, FOV kicks on dive/boost
    const back = 11;
    const up = 3.6;
    const fx = Math.sin(f.heading);
    const fz = Math.cos(f.heading);
    camPos.x += (f.pos.x - fx * back - camPos.x) * Math.min(1, 6 * dt);
    camPos.y += (f.pos.y + up - camPos.y) * Math.min(1, 6 * dt);
    camPos.z += (f.pos.z - fz * back - camPos.z) * Math.min(1, 6 * dt);
    if (shake > 0) {
      camPos.x += (Math.random() - 0.5) * shake;
      camPos.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - dt * 2);
    }
    camera.position.copy(camPos);
    camTarget.set(f.pos.x + fx * 22, f.pos.y + Math.sin(f.pitch) * 10, f.pos.z + fz * 22);
    camera.lookAt(camTarget);
    camera.rotateZ(f.roll * 0.45);
    const targetFov = 62 + (f.boosting ? 9 : 0) + (f.pitch < -0.15 ? 6 : 0);
    fov += (targetFov - fov) * Math.min(1, 4 * dt);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // ring spin: a slow shimmer so rings read as alive
    for (const mesh of ringPool) {
      if (mesh.visible) mesh.rotation.z += dt * 0.4;
    }

    // particles: drift, fall, die
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (pLife[i] <= 0) {
        pPos[i * 3 + 1] = -100;
        continue;
      }
      pLife[i] -= dt;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pVel[i * 3 + 1] -= 6 * dt;
    }
    pGeo.attributes.position.needsUpdate = true;

    // speed streaks: visible when fast, rushing past the camera
    const showStreaks = f.speed > 34;
    streaks.visible = showStreaks;
    if (showStreaks) {
      for (let i = 0; i < STREAK_COUNT; i++) {
        const s = streakData[i];
        s.z += f.speed * dt * 1.6;
        if (s.z > f.pos.z + 6 || s.z < f.pos.z - 40) {
          s.x = f.pos.x + (Math.random() - 0.5) * 46;
          s.y = f.pos.y + (Math.random() - 0.5) * 26;
          s.z = f.pos.z + 10 + Math.random() * 60;
          s.len = 3 + Math.random() * 5;
        }
        sPos[i * 6] = s.x;
        sPos[i * 6 + 1] = s.y;
        sPos[i * 6 + 2] = s.z;
        sPos[i * 6 + 3] = s.x;
        sPos[i * 6 + 4] = s.y;
        sPos[i * 6 + 5] = s.z + s.len;
      }
      sGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  return { resize, update, spawnBurst, setShake, setFlash, renderer, scene, camera };
}

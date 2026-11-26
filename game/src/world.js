// CANYON GLIDER — the world generator. The canyon is endless but never
// stored: it is cut into 120 m chunks, each one grown from its own seeded
// stream, so the same seed always grows the same canyon. Chunks ahead of the
// glider are generated on demand, chunks far behind are dropped. Difficulty
// ramps with distance, biomes change the palette, and every 720 m a
// set-piece chunk (spiral, tunnel or squall) breaks the rhythm.
import { CONFIG as C } from './config.js';
import { makeRng, chunkSeed } from './random.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function difficultyAt(distance) {
  const t = Math.min(1, distance / 4000);
  const d = C.difficulty;
  return {
    pillars: Math.round(lerp(d.pillarsPerChunk[0], d.pillarsPerChunk[1], t)),
    rings: Math.round(lerp(d.ringsPerChunk[0], d.ringsPerChunk[1], t)),
    wallVar: lerp(d.wallVariance[0], d.wallVariance[1], t),
    gust: lerp(d.gustStrength[0], d.gustStrength[1], t),
  };
}

export function biomeAt(distance) {
  let current = C.biomes[0];
  for (const b of C.biomes) {
    if (distance >= b.at) current = b;
  }
  return current;
}

function generateChunk(world, index) {
  const rng = makeRng(chunkSeed(world.seed, index));
  const z0 = index * C.chunkLength;
  const z1 = z0 + C.chunkLength;
  const distance = z0;
  const diff = difficultyAt(distance);
  const halfWidth = C.corridorHalfWidth;

  const chunk = {
    index,
    z0,
    z1,
    halfWidth,
    setPiece: null,
    walls: [],
    pillars: [],
    rings: [],
    mesas: [],
  };

  // --- set-piece every 720 m (chunk 6, 12, 18, ...) ---
  const isSetPiece = index > 0 && index % Math.round(C.setPieceEvery / C.chunkLength) === 0;
  if (isSetPiece) {
    chunk.setPiece = rng.pick(['spiral', 'tunnel', 'squall']);
  }

  // --- canyon walls: 4 blocks per side, heights jitter with difficulty ---
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const z = z0 + (i + 0.5) * (C.chunkLength / 4);
      const h = 45 + rng.range(-diff.wallVar, diff.wallVar) + rng.range(0, 25);
      chunk.walls.push({
        x: side * (halfWidth + 7 + rng.range(0, 6)),
        z,
        w: 14 + rng.range(0, 10),
        h,
        d: C.chunkLength / 4 + 2,
        y: h / 2,
      });
    }
  }

  // --- distant mesas outside the corridor, for the skyline ---
  const mesaCount = 3 + rng.int(0, 2);
  for (let i = 0; i < mesaCount; i++) {
    const side = rng.chance(0.5) ? -1 : 1;
    chunk.mesas.push({
      x: side * rng.range(halfWidth + 40, halfWidth + 160),
      z: z0 + rng.range(0, C.chunkLength),
      w: rng.range(30, 80),
      h: rng.range(25, 90),
      d: rng.range(30, 80),
      y: 0,
    });
  }

  // --- pillars: the obstacles. Kept clear of the centre line at the start ---
  const pillarCount = chunk.setPiece === 'squall' ? diff.pillars + 2 : diff.pillars;
  let lastZ = z0 + 10;
  for (let i = 0; i < pillarCount; i++) {
    const z = Math.min(z1 - 8, lastZ + rng.range(C.pillarMinGap, C.chunkLength / Math.max(1, pillarCount)));
    lastZ = z;
    const clearCentre = distance < 600; // first ~600 m (~23 s): no pillar on the centre line
    const x = clearCentre
      ? (rng.chance(0.5) ? -1 : 1) * rng.range(18, halfWidth - 10)
      : rng.range(-halfWidth + 10, halfWidth - 10);
    const r = rng.range(3, 6);
    const h = rng.range(18, 65);
    chunk.pillars.push({ x, y: 0, z, r, h, nearMissed: false });
  }

  // --- rings: gold for score, green for fuel ---
  if (chunk.setPiece === 'spiral') {
    // a spiral of 6 gold rings climbing through the chunk
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      chunk.rings.push({
        x: Math.cos(a) * 22,
        y: 45 + Math.sin(a) * 18,
        z: z0 + 15 + i * 16,
        kind: 'gold',
        taken: false,
      });
    }
  } else if (chunk.setPiece === 'tunnel') {
    // a straight tunnel of 5 rings, walls pulled in
    chunk.halfWidth = halfWidth * 0.62;
    for (let i = 0; i < 5; i++) {
      chunk.rings.push({
        x: rng.range(-8, 8),
        y: rng.range(30, 60),
        z: z0 + 14 + i * 20,
        kind: 'gold',
        taken: false,
      });
    }
  } else {
    const ringCount = diff.rings;
    for (let i = 0; i < ringCount; i++) {
      chunk.rings.push({
        x: rng.range(-halfWidth + 12, halfWidth - 12),
        y: rng.range(16, 72),
        z: z0 + rng.range(15, C.chunkLength - 10),
        kind: rng.chance(0.25) ? 'fuel' : 'gold',
        taken: false,
      });
    }
  }

  return chunk;
}

export function createWorld(seed) {
  const world = {
    seed,
    chunks: new Map(),
    // lateral wind, smooth over time and distance
    gustAt(distance, time) {
      const diff = difficultyAt(distance);
      if (diff.gust <= 0.01) return 0;
      return (
        Math.sin(time * 0.7 + distance * 0.011) * 0.6 +
        Math.sin(time * 1.7 + distance * 0.004) * 0.4
      ) * diff.gust;
    },
  };
  return world;
}

// Generate every chunk the glider could reach, drop the ones far behind.
// Call once per frame with the glider's z.
export function ensureChunks(world, z) {
  const frontIndex = Math.floor(z / C.chunkLength);
  const firstNeeded = frontIndex - C.chunksBehind;
  const lastNeeded = frontIndex + C.chunksAhead;
  for (let i = firstNeeded; i <= lastNeeded; i++) {
    if (i < 0) continue;
    if (!world.chunks.has(i)) {
      world.chunks.set(i, generateChunk(world, i));
    }
  }
  for (const key of [...world.chunks.keys()]) {
    if (key < firstNeeded || key > lastNeeded) world.chunks.delete(key);
  }
}

export function chunkFor(world, z) {
  return world.chunks.get(Math.floor(z / C.chunkLength));
}

// All pillars and rings near a z, for collision checks (cheap: one chunk).
export function nearbyHazards(world, z) {
  const chunk = chunkFor(world, z);
  if (!chunk) return { pillars: [], rings: [], halfWidth: C.corridorHalfWidth };
  return { pillars: chunk.pillars, rings: chunk.rings, halfWidth: chunk.halfWidth };
}

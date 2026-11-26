// CANYON GLIDER — the game itself. State machine (menu / playing / paused /
// crashed), scoring, missions, collisions and near-misses. It owns the
// flight state and the world, and tells the renderer and the HUD what to
// show. No DOM here except localStorage for the best score (guarded).
import { CONFIG as C } from './config.js';
import { createFlight, resetFlight, stepFlight, addFuel, hitDamage } from './flight.js';
import { createWorld, ensureChunks, nearbyHazards } from './world.js';

const MISSION_POOL = [
  { id: 'rings', label: 'Fly through rings', goal: 5 },
  { id: 'fuel', label: 'Collect fuel rings', goal: 2 },
  { id: 'near', label: 'Near-miss pillars', goal: 3 },
  { id: 'dist', label: 'Fly far', goal: 1000 },
  { id: 'combo', label: 'Reach combo x2.5', goal: 1 },
  { id: 'clean', label: 'Fly 800 m undamaged', goal: 800 },
];

function loadBest() {
  try {
    return Number(window.localStorage.getItem('canyon-glider-best') || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem('canyon-glider-best', String(Math.floor(value)));
  } catch {
    // private mode or no storage — the score still counts this flight
  }
}

export function createGame(seed) {
  const game = {
    seed,
    state: 'menu', // menu | playing | paused | crashed
    flight: createFlight(),
    world: createWorld(seed),
    score: 0,
    best: loadBest(),
    combo: 1,
    comboTimer: 0,
    missions: [],
    ringsCollected: 0,
    nearMisses: 0,
    slowMo: 0,
    time: 0,
    events: [], // one-frame event queue for the main loop (sound / fx)
    stats: { distance: 0, rings: 0, near: 0, missions: 0 },
  };
  game.missions = dealMissions(game, []);
  ensureChunks(game.world, 0);
  return game;
}

function dealMissions(game, excludeIds) {
  const picked = [];
  const pool = MISSION_POOL.filter((m) => !excludeIds.includes(m.id));
  while (picked.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    const template = pool.splice(i, 1)[0];
    picked.push({ ...template, progress: 0, done: false });
  }
  return picked;
}

function completeMission(game, mission) {
  mission.done = true;
  game.score += C.missionBonus;
  game.stats.missions += 1;
  game.events.push({ type: 'mission', label: mission.label });
  // replace it with a fresh mission of a different kind
  const replacement = dealMissions(game, [mission.id, ...game.missions.map((m) => m.id)]);
  const index = game.missions.indexOf(mission);
  if (replacement.length > 0 && index >= 0) {
    game.missions[index] = replacement[0];
  }
}

function progressMission(game, id, amount) {
  for (const m of game.missions) {
    if (m.id !== id || m.done) continue;
    if (id === 'combo') {
      if (game.combo >= 2.5) {
        m.progress = 1;
        completeMission(game, m);
      }
      continue;
    }
    m.progress += amount;
    if (m.progress >= m.goal) completeMission(game, m);
  }
}

function collectRing(game, ring) {
  ring.taken = true;
  game.ringsCollected += 1;
  game.stats.rings += 1;
  game.combo = Math.min(C.comboMax, game.combo + C.comboStep);
  game.comboTimer = C.comboWindow;
  const base = ring.kind === 'fuel' ? C.fuelRingScore : C.ringScore;
  const points = Math.round(base * game.combo);
  game.score += points;
  if (ring.kind === 'fuel') {
    addFuel(game.flight, C.fuelRingRefill);
    game.events.push({ type: 'fuel', points });
    progressMission(game, 'fuel', 1);
  } else {
    game.events.push({ type: 'ring', points, pos: { x: ring.x, y: ring.y, z: ring.z } });
  }
  progressMission(game, 'rings', 1);
  progressMission(game, 'combo', 0);
}

function checkCollisions(game) {
  const f = game.flight;
  const { pillars, rings, halfWidth } = nearbyHazards(game.world, f.pos.z);

  // rings: fly through the hoop
  for (const ring of rings) {
    if (ring.taken) continue;
    const dx = f.pos.x - ring.x;
    const dy = f.pos.y - ring.y;
    const dz = f.pos.z - ring.z;
    if (dx * dx + dy * dy + dz * dz < C.ringRadius * C.ringRadius) {
      collectRing(game, ring);
    }
  }

  // pillars: hit or near-miss
  for (const pillar of pillars) {
    const dx = f.pos.x - pillar.x;
    const dz = f.pos.z - pillar.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    if (f.pos.y > pillar.h) continue; // flew over it
    if (horizontal < pillar.r + 1.2) {
      if (f.invuln <= 0) {
        const crashed = hitDamage(f);
        game.combo = 1;
        game.events.push({ type: crashed ? 'crash' : 'hit' });
        for (const m of game.missions) if (m.id === 'clean') m.progress = 0;
        if (crashed) return 'crashed';
      }
    } else if (!pillar.nearMissed && horizontal < pillar.r + 4.5) {
      pillar.nearMissed = true;
      game.nearMisses += 1;
      game.stats.near += 1;
      const points = Math.round(C.nearMissScore * game.combo);
      game.score += points;
      game.slowMo = C.slowMoTime;
      game.events.push({ type: 'near', points });
      progressMission(game, 'near', 1);
    }
  }

  // canyon walls: scraping the edge hurts. The trigger sits at the wall's
  // inner face so the glider never visibly clips into the rock.
  if (Math.abs(f.pos.x) > halfWidth) {
    if (f.invuln <= 0) {
      const crashed = hitDamage(f);
      game.combo = 1;
      f.pos.x = Math.sign(f.pos.x) * (halfWidth - 2);
      f.heading = -f.heading * 0.4;
      game.events.push({ type: crashed ? 'crash' : 'hit' });
      for (const m of game.missions) if (m.id === 'clean') m.progress = 0;
      if (crashed) return 'crashed';
    }
  }

  // canyon floor: too low is a crash
  if (f.pos.y <= C.floorBase + C.minAltitude) {
    return 'crashed';
  }
  return null;
}

export function startFlight(game) {
  resetFlight(game.flight);
  game.world = createWorld(game.seed);
  ensureChunks(game.world, 0);
  game.score = 0;
  game.combo = 1;
  game.comboTimer = 0;
  game.ringsCollected = 0;
  game.nearMisses = 0;
  game.slowMo = 0;
  game.time = 0;
  game.missions = dealMissions(game, []);
  game.stats = { distance: 0, rings: 0, near: 0, missions: 0 };
  game.state = 'playing';
  game.events.push({ type: 'start' });
}

export function endFlight(game) {
  game.state = 'crashed';
  game.stats.distance = Math.floor(game.flight.distance);
  if (game.score > game.best) {
    game.best = game.score;
    saveBest(game.best);
  }
  game.events.push({ type: 'over', score: game.score, best: game.best });
}

// One fixed step. `input` is the polled action state. Returns the events
// that fired this step (the main loop turns them into sound and fx).
export function stepGame(game, input, dt) {
  game.events.length = 0;
  if (game.state === 'menu') {
    // idle drift: the glider circles gently above the canyon while waiting
    game.time += dt;
    game.flight.pos.y = 42 + Math.sin(game.time * 0.5) * 3;
    game.flight.heading = Math.sin(game.time * 0.12) * 0.25;
    game.flight.roll = Math.sin(game.time * 0.12 + 0.6) * 0.3;
    game.flight.pos.z = Math.sin(game.time * 0.1) * 20;
    ensureChunks(game.world, game.flight.pos.z);
    return game.events;
  }
  if (game.state !== 'playing') return game.events;

  game.time += dt;
  const f = game.flight;
  const gust = game.world.gustAt(f.distance, game.time);
  stepFlight(f, input, gust, dt);
  ensureChunks(game.world, f.pos.z);

  // combo decays if no ring is chained in time
  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) game.combo = 1;
  }
  if (game.slowMo > 0) game.slowMo -= dt;

  // distance points + mission progress
  game.score += f.speed * dt * C.distanceScore;
  progressMission(game, 'dist', f.speed * dt);
  progressMission(game, 'clean', f.speed * dt);

  const outcome = checkCollisions(game);
  if (outcome === 'crashed') {
    endFlight(game);
  }
  return game.events;
}

// CANYON GLIDER — boot and main loop. Fixed timestep (60 Hz physics,
// render every frame), slow-motion on near-miss, pause on tab hide, and
// deterministic screenshot modes (?shot=start|play|end&seed=N) so the
// dossier's screenshots are real renders of this code, every time.
import { CONFIG as C } from './config.js';
import { createGame, startFlight, stepGame } from './game.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { dailySeed } from './random.js';

function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot') || '',
    seed: Number(params.get('seed') || 0) || dailySeed(),
  };
}

// Autopilot for screenshot mode: a gentle centre-line weave, not a ring chase.
// A ring-chasing pilot fights the pillars and the walls; a smooth weave down
// the middle of the canyon reads as confident flight and, inside the opening
// clear-centre stretch, cannot hit anything. Steering is computed in the
// glider's own frame (lateral error relative to its heading).
function autopilot(game) {
  const f = game.flight;
  const targetX = Math.sin(f.pos.z * 0.01) * 8;
  const targetY = 42 + Math.sin(f.pos.z * 0.007) * 8;
  const dx = targetX - f.pos.x;
  const dz = 40; // look ahead, not at the target's z
  // lateral error in the glider's frame. NOTE the sign: the chase camera
  // looks along +Z, so screen-right is world -X — a positive steer banks
  // the glider toward -X, so steering toward a target at +X needs a
  // negative steer. Hence the minus below.
  const lateral = dx * Math.cos(f.heading) - dz * Math.sin(f.heading);
  const dy = targetY - f.pos.y;
  return {
    steer: Math.max(-0.5, Math.min(0.5, -lateral / 20)),
    pitch: Math.max(-0.5, Math.min(0.5, dy / 16)),
    boost: false,
    brake: false,
  };
}

function main() {
  const params = readParams();
  const canvas = document.getElementById('game-canvas');
  const game = createGame(params.seed);
  const renderer = createRenderer(canvas);
  const hud = createHud();
  const audio = createAudio();
  const input = createInput(window);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    renderer.resize(w, h);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // pause when the tab hides, so a switch never costs a flight
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') {
      game.state = 'paused';
      hud.showBanner('Paused', 'Press P to keep flying');
    }
  });

  function handleEvents(events) {
    for (const e of events) {
      if (e.type === 'ring') {
        audio.chime();
        renderer.spawnBurst(e.pos, 0xffc93c);
        hud.showToast(`+${e.points}  RING`);
      } else if (e.type === 'fuel') {
        audio.fuelChime();
        hud.showToast(`+${e.points}  FUEL +${C.fuelRingRefill}`);
      } else if (e.type === 'near') {
        audio.whoosh();
        hud.showToast(`NEAR MISS +${e.points}`);
      } else if (e.type === 'hit') {
        audio.hit();
        renderer.setShake(0.9);
        hud.showToast('HULL HIT');
      } else if (e.type === 'crash') {
        audio.crash();
        renderer.setShake(1.6);
      } else if (e.type === 'mission') {
        audio.mission();
        hud.showBanner('MISSION COMPLETE', `${e.label}  +${C.missionBonus}`);
      } else if (e.type === 'start') {
        hud.hideOverlays();
      } else if (e.type === 'over') {
        hud.showGameOver(e.score, e.best, `Distance ${Math.floor(game.flight.distance)} m · Rings ${game.stats.rings} · Near-misses ${game.stats.near}`);
      }
    }
  }

  // ---- deterministic screenshot modes ----
  if (params.shot === 'play' || params.shot === 'end') {
    startFlight(game);
    // fast-forward ~18 s of gentle flight so the shot is mid-flight, still
    // inside the opening clear-centre stretch where nothing can be hit
    for (let i = 0; i < 18 * 60; i++) {
      const events = stepGame(game, autopilot(game), C.fixedDt);
      handleEvents(events);
      if (game.state !== 'playing') break;
    }
    if (params.shot === 'end' && game.state === 'playing') {
      game.flight.damage = C.maxDamage;
      game.flight.pos.y = C.floorBase + C.minAltitude;
      const events = stepGame(game, { steer: 0, pitch: 0, boost: false, brake: false }, C.fixedDt);
      handleEvents(events);
    }
    hud.hideOverlays();
    if (params.shot === 'end') {
      hud.showGameOver(game.score, game.best, `Distance ${Math.floor(game.flight.distance)} m · Rings ${game.stats.rings} · Near-misses ${game.stats.near}`);
    }
  } else {
    hud.showMenu(game.best);
  }

  // ---- main loop: fixed-step physics, render every frame ----
  let last = performance.now();
  let accumulator = 0;
  let firstFrame = true;

  function frame(now) {
    requestAnimationFrame(frame);
    let frameDt = Math.min(C.maxFrameDt, (now - last) / 1000);
    last = now;
    if (firstFrame) {
      frameDt = C.fixedDt;
      firstFrame = false;
    }

    // one-shot keys
    if (input.consume('pause')) {
      if (game.state === 'playing') {
        game.state = 'paused';
        hud.showBanner('Paused', 'Press P to keep flying');
      } else if (game.state === 'paused') {
        game.state = 'playing';
        hud.hideOverlays();
      }
    }
    if (input.consume('mute')) {
      const muted = audio.toggleMute();
      hud.showToast(muted ? 'Sound off' : 'Sound on');
    }
    if (input.consume('retry')) {
      if (game.state === 'crashed' || game.state === 'playing') {
        startFlight(game);
        handleEvents(game.events);
      }
    }
    if (game.state === 'menu' && input.state.anyKey) {
      audio.unlock();
      startFlight(game);
      handleEvents(game.events);
    }
    if (game.state === 'playing' && input.state.anyKey) audio.unlock();

    // physics: fixed steps, slowed to 35% during a near-miss slow-mo
    if (game.state === 'playing' || game.state === 'menu') {
      const scale = game.slowMo > 0 ? 0.35 : 1;
      accumulator += frameDt * scale;
      let steps = 0;
      while (accumulator >= C.fixedDt && steps < 5) {
        const actions = params.shot ? autopilot(game) : input.poll();
        const events = stepGame(game, actions, C.fixedDt);
        handleEvents(events);
        accumulator -= C.fixedDt;
        steps++;
      }
      if (steps >= 5) accumulator = 0;
      audio.setWind(game.flight.speed);
    }

    hud.update(game, frameDt);
    renderer.update(game, game.world, frameDt, now / 1000);
  }
  requestAnimationFrame(frame);

  // retry buttons on the overlays
  document.getElementById('btn-fly').addEventListener('click', () => {
    audio.unlock();
    startFlight(game);
    handleEvents(game.events);
  });
  document.getElementById('btn-retry').addEventListener('click', () => {
    audio.unlock();
    startFlight(game);
    handleEvents(game.events);
  });
}

main();

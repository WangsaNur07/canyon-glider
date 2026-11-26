// CANYON GLIDER — the flight model. Pure numbers, no rendering: given the
// pilot's actions and a gust of wind, it moves the glider for one step.
// Forgiving on purpose: banking turns the glider, diving trades altitude for
// speed, climbing bleeds speed, and nothing kills you in the first seconds.
import { CONFIG as C } from './config.js';

export function createFlight() {
  return {
    pos: { x: 0, y: 42, z: 0 },
    heading: 0, // rad, 0 = +Z
    pitch: 0, // rad, positive = nose up
    roll: 0, // rad, positive = bank right
    speed: C.baseSpeed,
    throttle: 0, // 0..1, boost amount actually applied
    fuel: C.fuelMax,
    damage: 0,
    invuln: 0, // seconds of grace left after a hit
    distance: 0, // metres flown this flight
    boosting: false,
    stalled: false,
  };
}

export function resetFlight(f) {
  f.pos.x = 0;
  f.pos.y = 42;
  f.pos.z = 0;
  f.heading = 0;
  f.pitch = 0;
  f.roll = 0;
  f.speed = C.baseSpeed;
  f.throttle = 0;
  f.fuel = C.fuelMax;
  f.damage = 0;
  f.invuln = 0;
  f.distance = 0;
  f.boosting = false;
  f.stalled = false;
}

// One fixed step. `gust` is the lateral wind this step (-1..1, scaled by the
// world). Returns nothing; the state object is mutated in place.
export function stepFlight(f, input, gust, dt) {
  // --- banking: steer toward a target bank, then turn with the bank ---
  const targetRoll = input.steer * C.maxBank;
  f.roll += (targetRoll - f.roll) * Math.min(1, C.bankRate * dt);
  f.heading += -f.roll * C.turnRate * dt;
  // keep the heading in [-PI, PI] so a long flight never grows the angle
  if (f.heading > Math.PI) f.heading -= Math.PI * 2;
  if (f.heading < -Math.PI) f.heading += Math.PI * 2;

  // --- pitch: climb and dive ---
  const targetPitch =
    input.pitch > 0 ? input.pitch * C.maxPitchUp : input.pitch * -C.maxPitchDown;
  f.pitch += (targetPitch - f.pitch) * Math.min(1, C.pitchRate * dt);

  // --- speed: throttle, dive, climb and drag ---
  f.boosting = input.boost && f.fuel > 0;
  let targetSpeed = C.baseSpeed;
  if (f.boosting) targetSpeed = C.boostSpeed;
  if (f.pitch < 0) targetSpeed += -f.pitch * C.diveSpeedGain * 4;
  if (f.pitch > 0) targetSpeed -= f.pitch * C.climbSpeedLoss * 4;
  if (input.brake) targetSpeed -= C.airbrakeDrag;
  targetSpeed = Math.max(C.minSpeed, Math.min(C.maxSpeed, targetSpeed));
  f.speed += (targetSpeed - f.speed) * Math.min(1, C.accel * dt / C.baseSpeed);

  // --- fuel: cruise sips it, boost gulps it ---
  const drain = f.boosting ? C.fuelBoostDrain : C.fuelDrain;
  f.fuel = Math.max(0, f.fuel - drain * dt);
  f.throttle = f.boosting ? 1 : 0;
  f.stalled = f.fuel <= 0;

  // --- position: forward along the heading, up/down with the pitch ---
  const forwardX = Math.sin(f.heading);
  const forwardZ = Math.cos(f.heading);
  const vertical = Math.sin(f.pitch) * f.speed;
  f.pos.x += (forwardX * f.speed + gust) * dt;
  f.pos.y += vertical * dt;
  f.pos.z += forwardZ * f.speed * dt;
  f.distance += f.speed * dt;

  // --- soft ceiling: the sky pushes back instead of punishing ---
  if (f.pos.y > C.ceiling) {
    f.pos.y = C.ceiling;
    f.pitch = Math.min(f.pitch, 0);
  }
  // --- floor: never sink below the canyon floor in the model itself ---
  if (f.pos.y < C.floorBase + 2) {
    f.pos.y = C.floorBase + 2;
  }

  if (f.invuln > 0) f.invuln -= dt;
}

export function addFuel(f, amount) {
  f.fuel = Math.min(C.fuelMax, f.fuel + amount);
}

export function hitDamage(f) {
  if (f.invuln > 0) return false;
  f.damage += 1;
  f.invuln = C.invulnTime;
  f.speed = Math.max(C.minSpeed, f.speed * 0.55);
  return f.damage >= C.maxDamage;
}

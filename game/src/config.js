// CANYON GLIDER — tuning constants. One place for every number that shapes
// how the game feels, so balancing is a data change, never a code hunt.
export const CONFIG = {
  // ---- flight ----
  baseSpeed: 26, // m/s cruise, no input
  minSpeed: 12, // slowest the glider can fly (stall floor)
  maxSpeed: 58, // fastest in a dive
  boostSpeed: 70, // with throttle boost held
  accel: 14, // m/s^2 toward target speed
  climbRate: 10, // m/s vertical when pulling up
  diveRate: 16, // m/s vertical when diving
  diveSpeedGain: 9, // extra m/s gained while diving
  climbSpeedLoss: 7, // m/s bled while climbing
  bankRate: 2.4, // rad/s toward target bank
  maxBank: 0.9, // rad, full bank
  turnRate: 1.05, // rad/s of heading change at full bank
  pitchRate: 1.9, // rad/s toward target pitch
  maxPitchUp: 0.42, // rad
  maxPitchDown: -0.5, // rad
  airbrakeDrag: 16, // extra decel while airbrake held
  // ---- fuel ----
  fuelMax: 100,
  fuelDrain: 1.1, // per second at cruise
  fuelBoostDrain: 7.0, // per second while boosting
  fuelRingRefill: 35, // fuel restored by a green ring
  fuelLowWarn: 25, // HUD warning below this
  // ---- damage ----
  maxDamage: 3, // hits before the glider crashes
  invulnTime: 1.6, // seconds of grace after a hit
  // ---- scoring ----
  ringScore: 100, // base points per gold ring
  fuelRingScore: 60, // base points per green ring
  nearMissScore: 50, // base points per near-miss
  missionBonus: 500, // points per completed mission
  distanceScore: 1, // points per metre flown
  comboStep: 0.5, // multiplier grows by this per chained ring
  comboMax: 4, // multiplier cap
  comboWindow: 7, // seconds to keep a chain alive (forgiving on purpose)
  // ---- world ----
  chunkLength: 120, // metres per generated chunk
  chunksAhead: 6, // chunks kept generated in front
  chunksBehind: 2, // chunks kept behind before recycle
  corridorHalfWidth: 52, // canyon walls sit beyond this |x|
  floorBase: 0, // canyon floor height at start
  ceiling: 95, // soft ceiling, glider is pushed down above this
  minAltitude: 6, // floor clearance before a crash counts
  ringRadius: 7, // fly-through radius of a ring
  pillarMinGap: 26, // minimum spacing between pillars in a chunk
  // ---- difficulty curve (by distance in metres) ----
  difficulty: {
    pillarsPerChunk: [2, 5], // [at 0m, at 4000m]
    ringsPerChunk: [3, 2],
    wallVariance: [6, 18], // wall height jitter grows
    gustStrength: [0, 4], // lateral wind gusts
  },
  // ---- biomes (distance thresholds, metres) ----
  biomes: [
    { at: 0, name: 'canyon dawn', sky: 0xffd9a0, fog: 0xf2b27a, sun: 0xffe0b3 },
    { at: 1500, name: 'ocean islands', sky: 0x9fd8ff, fog: 0x8ec9ee, sun: 0xffffff },
    { at: 3500, name: 'storm night', sky: 0x2a2f4a, fog: 0x232742, sun: 0x8fa3ff },
  ],
  // ---- set-pieces (every N metres a special chunk) ----
  setPieceEvery: 720, // metres between set-piece chunks
  // ---- juice ----
  slowMoTime: 0.35, // seconds of slow motion on a near-miss
  shakeTime: 0.5, // seconds of screen shake on a crash
  // ---- loop ----
  fixedDt: 1 / 60, // physics step
  maxFrameDt: 0.1, // clamp for tab-switch spikes
};

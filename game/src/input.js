// CANYON GLIDER — input abstraction. Raw keys, pointer drags and gamepad
// sticks all collapse into the same small set of ACTIONS, so the flight
// model never sees a key code: "steer" is -1..1, "pitch" is -1..1, and the
// rest are booleans. Keyboard, mouse, touch and gamepad all drive it.
export function createInput(target) {
  const keys = new Set();
  const state = {
    steer: 0, // -1 left .. 1 right
    pitch: 0, // -1 dive .. 1 climb
    boost: false,
    brake: false,
    paused: false,
    retry: false,
    mute: false,
    anyKey: false,
    pointerActive: false,
  };

  // Pointer drag: horizontal drag steers, vertical drag pitches. The drag
  // is relative to where the press started, so one thumb can fly anywhere.
  let dragStart = null;
  let dragNow = null;
  const DRAG_RANGE = 90; // px of drag for full deflection

  function keyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    state.anyKey = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') state.paused = true;
    if (e.code === 'KeyR') state.retry = true;
    if (e.code === 'KeyM') state.mute = true;
  }
  function keyUp(e) {
    keys.delete(e.code);
  }
  function pointerDown(e) {
    dragStart = { x: e.clientX, y: e.clientY };
    dragNow = dragStart;
    state.pointerActive = true;
    state.anyKey = true;
  }
  function pointerMove(e) {
    if (dragStart) dragNow = { x: e.clientX, y: e.clientY };
  }
  function pointerUp() {
    dragStart = null;
    dragNow = null;
    state.pointerActive = false;
  }

  target.addEventListener('keydown', keyDown);
  target.addEventListener('keyup', keyUp);
  target.addEventListener('pointerdown', pointerDown);
  target.addEventListener('pointermove', pointerMove);
  target.addEventListener('pointerup', pointerUp);
  target.addEventListener('pointercancel', pointerUp);
  target.addEventListener('blur', () => keys.clear());

  function readGamepad() {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        return pad;
      }
    } catch {
      // gamepad API unavailable — keyboard and pointer still work
    }
    return null;
  }

  // Recompute the actions from every source. Call once per physics step.
  function poll() {
    let steer = 0;
    let pitch = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) pitch += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) pitch -= 1;

    if (dragStart && dragNow) {
      steer += Math.max(-1, Math.min(1, (dragNow.x - dragStart.x) / DRAG_RANGE));
      pitch += Math.max(-1, Math.min(1, (dragStart.y - dragNow.y) / DRAG_RANGE));
    }

    const pad = readGamepad();
    let padBoost = false;
    if (pad) {
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      if (Math.abs(ax) > 0.12) steer += ax;
      if (Math.abs(ay) > 0.12) pitch -= ay;
      if (pad.buttons[7] && pad.buttons[7].pressed) padBoost = true;
      if (pad.buttons[0] && pad.buttons[0].pressed) state.anyKey = true;
    }

    state.steer = Math.max(-1, Math.min(1, steer));
    state.pitch = Math.max(-1, Math.min(1, pitch));
    // recomputed fresh every poll: never latch boost on from a stale press
    state.boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || padBoost;
    state.brake = keys.has('Space');
    return state;
  }

  // One-shot flags are consumed by the game loop so a single press fires once.
  function consume(flag) {
    const value = state[flag];
    state[flag] = false;
    return value;
  }

  function dispose() {
    target.removeEventListener('keydown', keyDown);
    target.removeEventListener('keyup', keyUp);
    target.removeEventListener('pointerdown', pointerDown);
    target.removeEventListener('pointermove', pointerMove);
    target.removeEventListener('pointerup', pointerUp);
    target.removeEventListener('pointercancel', pointerUp);
  }

  return { state, poll, consume, dispose };
}

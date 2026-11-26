// CANYON GLIDER — procedural audio. No sound files: every sound is built
// from oscillators and filtered noise in WebAudio, so the game ships zero
// audio assets and never touches the network. The context is created on the
// first user gesture (browser autoplay policy) and every call is guarded,
// so a missing audio device can never break the game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let padOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // wind: looped noise through a lowpass whose frequency follows speed
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 400;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      noise.start();
      startPad();
      return true;
    } catch {
      return false;
    }
  }

  function startPad() {
    if (padOn || !ctx) return;
    padOn = true;
    try {
      const padGain = ctx.createGain();
      padGain.gain.value = 0.035;
      padGain.connect(master);
      for (const freq of [110, 164.8, 220]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = Math.random() * 6 - 3;
        osc.connect(padGain);
        osc.start();
      }
    } catch {
      // pad is decoration; the game plays on without it
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || !master) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch {
      // a missed blip is never worth crashing over
    }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || !master) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // see tone()
    }
  }

  return {
    // call from any user gesture (click, key, touch) to unlock audio
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    // wind follows speed: call every frame with speed in m/s
    setWind(speed) {
      if (!ctx || !windGain || !windFilter) return;
      if (ctx.state !== 'running') return; // suspended: no point automating
      const target = Math.min(0.24, Math.max(0.02, (speed - 10) * 0.005));
      windGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      windFilter.frequency.setTargetAtTime(300 + speed * 22, ctx.currentTime, 0.1);
    },
    chime() {
      tone(659.3, 0.5, 'sine', 0.22);
      tone(987.8, 0.6, 'sine', 0.16, 0.06);
    },
    fuelChime() {
      tone(523.3, 0.4, 'sine', 0.2);
      tone(784, 0.5, 'sine', 0.16, 0.05);
    },
    whoosh() {
      noiseBurst(0.28, 0.3, 2400);
    },
    hit() {
      noiseBurst(0.3, 0.5, 500);
      tone(90, 0.35, 'sawtooth', 0.25);
    },
    crash() {
      noiseBurst(0.8, 0.6, 320);
      tone(55, 0.9, 'sawtooth', 0.3);
    },
    mission() {
      tone(523.3, 0.3, 'triangle', 0.2);
      tone(659.3, 0.3, 'triangle', 0.2, 0.09);
      tone(784, 0.45, 'triangle', 0.22, 0.18);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}

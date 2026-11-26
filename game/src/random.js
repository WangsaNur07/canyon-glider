// CANYON GLIDER — seeded random numbers. Every procedural choice in the world
// comes from one of these, so a seed reproduces the exact same canyon, the
// same rings and the same pillars: fair for the daily challenge, and the
// screenshots are deterministic too.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    range(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max]
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    // one element of an array
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
    // a shuffled copy of an array (Fisher-Yates, seeded)
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

// Daily seed: YYYYMMDD as a number, so every player flies the same canyon
// on the same day. Falls back to 1 when the clock is unavailable.
export function dailySeed() {
  try {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  } catch {
    return 1;
  }
}

// Mix a chunk index into the world seed so each chunk has its own stream
// without the streams ever overlapping.
export function chunkSeed(worldSeed, chunkIndex) {
  return (worldSeed * 2654435761 + chunkIndex * 40503) >>> 0;
}

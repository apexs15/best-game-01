// Seeded random numbers (mulberry32): the same seed always deals the same game,
// which is what makes a screenshot reproducible and a run fair to re-play.

/** A function returning a fresh number in [0, 1) on every call. */
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** One of the array's entries, uniformly. */
export function pick(random, entries) {
  return entries[Math.floor(random() * entries.length)];
}

// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves a run holds; clearing the last one wins the game. */
export const WAVES = 10;

export const PLAYER = {
  radius: 14,
  /** Acceleration in field units per second squared. */
  accel: 2600,
  maxSpeed: 430,
  /** Velocity retained per second (exponential damping). */
  damping: 0.14,
  fireInterval: 0.15,
  bulletSpeed: 820,
  hull: 3,
  invulnerable: 1.6,
  /** NOVA charge (0-100) a full bar holds. */
  novaNeed: 100,
  /** Charge one core gives. */
  coreCharge: 12,
};

export const BULLET = { radius: 4, life: 1.1, speed: 820 };

export const SHARD = {
  dart: { radius: 13, hp: 1, speed: 165, score: 50, cores: 1, wobble: 2.2 },
  hex: { radius: 22, hp: 3, speed: 72, score: 120, cores: 2, shootInterval: 2.3, shootRange: 540 },
  splitter: { radius: 17, hp: 2, speed: 118, score: 100, cores: 1 },
  warden: { radius: 46, hp: 26, speed: 44, score: 600, cores: 8, burstInterval: 3.4, burstCount: 10 },
};

/** Enemy shots. */
export const ORB = { radius: 7, speed: 215, life: 6 };

/** The cores shards drop; collecting them charges the NOVA bar. */
export const CORE = { radius: 8, score: 10, magnet: 175, collect: 30 };

/** Kills chained inside this window raise the combo multiplier. */
export const COMBO = { window: 2.0, perStep: 3, max: 5 };

/** Seconds of breather between waves, and the wave-clear bonus per wave. */
export const WAVE_CLEAR_BONUS = 100;
export const BREATHER = 3.0;

/** Seconds a shard takes to phase in after spawning (flashes, cannot be hit yet). */
export const SPAWN_IN = 0.5;

/** How many particles the world keeps at most; the oldest are dropped. */
export const MAX_PARTICLES = 420;

export const PALETTE = {
  backdrop: '#05070f',
  space: '#0a0f22',
  grid: '#141c36',
  star: '#cdd8ff',
  player: '#4df3ff',
  playerCore: '#e8fdff',
  bullet: '#bff6ff',
  dart: '#ff4d8d',
  hex: '#ffb020',
  splitter: '#b46bff',
  warden: '#ff5a3c',
  orb: '#ff7a5c',
  core: '#ffd94d',
  nova: '#aef7ff',
  panel: '#101a30',
  panelEdge: '#2a3c66',
  text: '#eaf2ff',
  muted: '#8b98b8',
  danger: '#ff5a6e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nova-shards.best';

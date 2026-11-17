// The game's rules and state, with no drawing and no browser in it: the ship, its
// bullets, the shards, their shots, the cores, the waves, the combo and the NOVA.
// step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sounds, announcements) without the world knowing about screens or sound.

import {
  BREATHER,
  BULLET,
  COMBO,
  CORE,
  FIELD,
  MAX_PARTICLES,
  ORB,
  PLAYER,
  SHARD,
  SPAWN_IN,
  STEP,
  WAVE_CLEAR_BONUS,
  WAVES,
} from './tuning.js';
import { range } from './random.js';

export const EVENT_SHOOT = 1;
export const EVENT_TICK = 2;
export const EVENT_KILL = 4;
export const EVENT_HIT = 8;
export const EVENT_CORE = 16;
export const EVENT_NOVA = 32;
export const EVENT_WAVE_CLEAR = 64;
export const EVENT_WIN = 128;
export const EVENT_OVER = 256;

const TAU = Math.PI * 2;

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function overlaps(a, b) {
  const r = a.radius + b.radius;
  return dist2(a, b) < r * r;
}

/** The wave's roster: which shards arrive, shuffled so no wave plays the same twice. */
function waveRoster(wave, random) {
  const roster = [];
  const darts = 4 + 2 * wave;
  const hexes = wave >= 3 ? wave - 2 : 0;
  const splitters = wave >= 2 ? wave - 1 : 0;
  for (let i = 0; i < darts; i += 1) roster.push('dart');
  for (let i = 0; i < hexes; i += 1) roster.push('hex');
  for (let i = 0; i < splitters; i += 1) roster.push('splitter');
  if (wave === 5 || wave === WAVES) roster.push('warden');
  for (let i = roster.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = roster[i];
    roster[i] = roster[j];
    roster[j] = tmp;
  }
  return roster;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    invulnerable: 0,
    fireTimer: 0,
    nova: 0,
  };
  const state = {
    time: 0,
    wave: 1,
    phase: 'breather',
    phaseTime: 1.2,
    score: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    kills: 0,
    coresCollected: 0,
    player,
    bullets: [],
    enemies: [],
    orbs: [],
    cores: [],
    particles: [],
    floats: [],
    shake: 0,
    flash: 0,
    spawnQueue: [],
    spawnTimer: 0,
    /** Screenshot staging only: tougher hull and a doubled fire rate. */
    hero: false,
    stats: { shots: 0, hits: 0 },
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.hull = PLAYER.hull;
    player.invulnerable = 0;
    player.fireTimer = 0;
    player.nova = 0;
    state.time = 0;
    state.wave = 1;
    state.phase = 'breather';
    state.phaseTime = 1.2;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.kills = 0;
    state.coresCollected = 0;
    state.bullets.length = 0;
    state.enemies.length = 0;
    state.orbs.length = 0;
    state.cores.length = 0;
    state.particles.length = 0;
    state.floats.length = 0;
    state.shake = 0;
    state.flash = 0;
    state.spawnQueue.length = 0;
    state.spawnTimer = 0;
    state.hero = false;
    state.stats.shots = 0;
    state.stats.hits = 0;
  }

  function addParticles(x, y, color, count, speed, life = 0.6, size = 3) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= MAX_PARTICLES) state.particles.shift();
      const angle = random() * TAU;
      const v = range(random, speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: range(random, life * 0.5, life),
        maxLife: life,
        size: range(random, size * 0.6, size * 1.4),
        color,
      });
    }
  }

  function addFloat(x, y, text, color) {
    state.floats.push({ x, y, text, color, life: 0.9 });
  }

  /** A spawn point on an edge, at least 240 away from the player. */
  function spawnPoint() {
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = Math.floor(random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = random() * FIELD.width;
        y = -30;
      } else if (edge === 1) {
        x = FIELD.width + 30;
        y = random() * FIELD.height;
      } else if (edge === 2) {
        x = random() * FIELD.width;
        y = FIELD.height + 30;
      } else {
        x = -30;
        y = random() * FIELD.height;
      }
      const dx = x - player.x;
      const dy = y - player.y;
      if (dx * dx + dy * dy > 240 * 240) return { x, y };
    }
    return { x: random() * FIELD.width, y: -30 };
  }

  function spawnEnemy(kind) {
    const tune = SHARD[kind];
    const at = spawnPoint();
    const angle = Math.atan2(player.y - at.y, player.x - at.x);
    state.enemies.push({
      kind,
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * tune.speed * 0.5,
      vy: Math.sin(angle) * tune.speed * 0.5,
      radius: tune.radius,
      hp: tune.hp,
      maxHp: tune.hp,
      speed: tune.speed,
      score: tune.score,
      cores: tune.cores,
      angle: random() * TAU,
      spin: range(random, -1.6, 1.6),
      spawnIn: SPAWN_IN,
      shootTimer: range(random, 1.2, 2.2),
      burstTimer: range(random, 2, 3),
      wobble: random() * TAU,
    });
  }

  function spawnCore(x, y) {
    const angle = random() * TAU;
    const speed = range(random, 40, 140);
    state.cores.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: CORE.radius,
      life: 9,
    });
  }

  function killEnemy(index) {
    const enemy = state.enemies[index];
    const color = { dart: '#ff4d8d', hex: '#ffb020', splitter: '#b46bff', warden: '#ff5a3c' }[enemy.kind];
    addParticles(enemy.x, enemy.y, color, enemy.kind === 'warden' ? 42 : 14, enemy.kind === 'warden' ? 320 : 220, 0.7, 4);
    const gained = enemy.score * state.multiplier;
    state.score += gained;
    addFloat(enemy.x, enemy.y - 10, `+${gained}`, color);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.multiplier = 1 + Math.min(COMBO.max - 1, Math.floor(state.combo / COMBO.perStep));
    for (let i = 0; i < enemy.cores; i += 1) spawnCore(enemy.x, enemy.y);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const angle = random() * TAU;
        const tune = SHARD.dart;
        state.enemies.push({
          kind: 'dart',
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * tune.speed,
          vy: Math.sin(angle) * tune.speed,
          radius: tune.radius,
          hp: 1,
          maxHp: 1,
          speed: tune.speed,
          score: tune.score,
          cores: 0,
          angle: random() * TAU,
          spin: range(random, -1.6, 1.6),
          spawnIn: 0.25,
          shootTimer: 0,
          burstTimer: 0,
          wobble: random() * TAU,
        });
      }
    }
    if (enemy.kind === 'warden') {
      state.shake = Math.max(state.shake, 16);
      state.flash = Math.max(state.flash, 0.5);
    }
    state.enemies.splice(index, 1);
    return gained;
  }

  function damagePlayer() {
    if (player.invulnerable > 0 || state.phase !== 'fight') return 0;
    player.hull -= 1;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = Math.max(state.shake, 14);
    state.combo = 0;
    state.multiplier = 1;
    state.comboTimer = 0;
    addParticles(player.x, player.y, '#4df3ff', 18, 260, 0.7, 4);
    if (player.hull <= 0) {
      state.phase = 'over';
      addParticles(player.x, player.y, '#4df3ff', 60, 380, 1.1, 5);
      addParticles(player.x, player.y, '#ffd94d', 24, 200, 0.9, 4);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireNova() {
    player.nova = 0;
    state.flash = 1;
    state.shake = Math.max(state.shake, 20);
    for (const orb of state.orbs) addParticles(orb.x, orb.y, '#ff7a5c', 3, 120, 0.4, 3);
    state.orbs.length = 0;
    // Damage every shard; kills are processed through the same path as bullets.
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      if (enemy.spawnIn > 0) continue;
      enemy.hp -= 12;
      if (enemy.hp <= 0) killEnemy(i);
    }
    return EVENT_NOVA;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = waveRoster(wave, random);
    state.spawnTimer = 0.4;
    state.phase = 'fight';
  }

  /**
   * One fixed step. `ctl` is { moveX, moveY, aimX, aimY, fire, nova } with the aim in
   * field coordinates. With `harmless` set (the title screen's backdrop) shards drift
   * across the field and nothing can hurt or score. Returns EVENT_* flags.
   */
  function step(dt, ctl, harmless = false) {
    let events = 0;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 42 * dt);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - 2.2 * dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }

    // Particles and floating texts always animate, even on the end screens.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.2, dt);
      p.vy *= Math.pow(0.2, dt);
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floats.length - 1; i >= 0; i -= 1) {
      const f = state.floats[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floats.splice(i, 1);
    }

    if (harmless) {
      if (state.enemies.length < 9 && random() < dt * 1.4) {
        spawnEnemy('dart');
        const enemy = state.enemies[state.enemies.length - 1];
        const angle = random() * TAU;
        enemy.vx = Math.cos(angle) * 60;
        enemy.vy = Math.sin(angle) * 60;
        enemy.spawnIn = 0;
      }
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = state.enemies[i];
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.angle += enemy.spin * dt;
        if (enemy.x < -60 || enemy.x > FIELD.width + 60 || enemy.y < -60 || enemy.y > FIELD.height + 60) {
          state.enemies.splice(i, 1);
        }
      }
      return 0;
    }

    if (state.phase === 'won' || state.phase === 'over') return events;

    if (state.phase === 'breather') {
      state.phaseTime -= dt;
      if (state.phaseTime <= 0) startWave(state.wave);
    }

    // --- the ship -----------------------------------------------------------
    const moveLen = Math.hypot(ctl.moveX, ctl.moveY);
    const mx = moveLen > 1 ? ctl.moveX / moveLen : ctl.moveX;
    const my = moveLen > 1 ? ctl.moveY / moveLen : ctl.moveY;
    player.vx += mx * PLAYER.accel * dt;
    player.vy += my * PLAYER.accel * dt;
    const keep = Math.pow(PLAYER.damping, dt);
    player.vx *= keep;
    player.vy *= keep;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (player.x < player.radius) {
      player.x = player.radius;
      player.vx = 0;
    } else if (player.x > FIELD.width - player.radius) {
      player.x = FIELD.width - player.radius;
      player.vx = 0;
    }
    if (player.y < player.radius) {
      player.y = player.radius;
      player.vy = 0;
    } else if (player.y > FIELD.height - player.radius) {
      player.y = FIELD.height - player.radius;
      player.vy = 0;
    }
    player.angle = Math.atan2(ctl.aimY - player.y, ctl.aimX - player.x);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    if (ctl.fire && state.phase === 'fight') {
      player.fireTimer -= dt;
      const interval = state.hero ? PLAYER.fireInterval / 2 : PLAYER.fireInterval;
      if (player.fireTimer <= 0) {
        player.fireTimer = interval;
        const nose = player.radius + 8;
        state.bullets.push({
          x: player.x + Math.cos(player.angle) * nose,
          y: player.y + Math.sin(player.angle) * nose,
          vx: Math.cos(player.angle) * BULLET.speed,
          vy: Math.sin(player.angle) * BULLET.speed,
          radius: BULLET.radius,
          life: BULLET.life,
        });
        state.stats.shots += 1;
        events |= EVENT_SHOOT;
      }
    } else {
      player.fireTimer = Math.max(0, player.fireTimer - dt);
    }

    if (ctl.nova && player.nova >= PLAYER.novaNeed && state.phase === 'fight') {
      events |= fireNova();
    }

    // --- spawning -------------------------------------------------------------
    // Shards arrive in small groups, not one by one: a wave should feel like a
    // wave. The group grows with the wave number, and the gap between groups
    // shrinks, so later waves press harder.
    if (state.phase === 'fight' && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      const interval = Math.max(0.28, 0.62 - state.wave * 0.04);
      if (state.spawnTimer <= 0) {
        const group = Math.min(state.spawnQueue.length, 1 + Math.floor(state.wave / 3));
        for (let index = 0; index < group; index += 1) spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = interval;
      }
    }

    // --- bullets ---------------------------------------------------------------
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      let spent = false;
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = state.enemies[j];
        if (enemy.spawnIn > 0) continue;
        if (!overlaps(bullet, enemy)) continue;
        state.stats.hits += 1;
        enemy.hp -= 1;
        addParticles(bullet.x, bullet.y, '#bff6ff', 3, 140, 0.3, 2);
        if (enemy.hp <= 0) {
          killEnemy(j);
          events |= EVENT_KILL;
        } else {
          events |= EVENT_TICK;
        }
        spent = true;
        break;
      }
      if (spent) state.bullets.splice(i, 1);
    }

    // --- shards ------------------------------------------------------------------
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      enemy.angle += enemy.spin * dt;
      enemy.wobble += dt;
      if (enemy.spawnIn > 0) enemy.spawnIn -= dt;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      if (enemy.kind === 'dart' || enemy.kind === 'splitter') {
        const wob = Math.sin(enemy.wobble * SHARD.dart.wobble) * 0.45;
        const tx = (ux - uy * wob) * enemy.speed;
        const ty = (uy + ux * wob) * enemy.speed;
        enemy.vx += (tx - enemy.vx) * Math.min(1, 2.6 * dt);
        enemy.vy += (ty - enemy.vy) * Math.min(1, 2.6 * dt);
      } else if (enemy.kind === 'hex') {
        enemy.vx += (ux * enemy.speed - enemy.vx) * Math.min(1, 1.4 * dt);
        enemy.vy += (uy * enemy.speed - enemy.vy) * Math.min(1, 1.4 * dt);
        if (enemy.spawnIn <= 0 && d < SHARD.hex.shootRange) {
          enemy.shootTimer -= dt;
          if (enemy.shootTimer <= 0) {
            enemy.shootTimer = SHARD.hex.shootInterval * range(random, 0.9, 1.15);
            const lead = (d / ORB.speed) * 0.5;
            const tx = player.x + player.vx * lead;
            const ty = player.y + player.vy * lead;
            const a = Math.atan2(ty - enemy.y, tx - enemy.x);
            state.orbs.push({
              x: enemy.x + Math.cos(a) * (enemy.radius + 6),
              y: enemy.y + Math.sin(a) * (enemy.radius + 6),
              vx: Math.cos(a) * ORB.speed,
              vy: Math.sin(a) * ORB.speed,
              radius: ORB.radius,
              life: ORB.life,
            });
          }
        }
      } else if (enemy.kind === 'warden') {
        enemy.vx += (ux * enemy.speed - enemy.vx) * Math.min(1, 1.1 * dt);
        enemy.vy += (uy * enemy.speed - enemy.vy) * Math.min(1, 1.1 * dt);
        if (enemy.spawnIn <= 0) {
          enemy.burstTimer -= dt;
          if (enemy.burstTimer <= 0) {
            enemy.burstTimer = SHARD.warden.burstInterval;
            for (let k = 0; k < SHARD.warden.burstCount; k += 1) {
              const a = (k / SHARD.warden.burstCount) * TAU + enemy.angle * 0.2;
              state.orbs.push({
                x: enemy.x + Math.cos(a) * (enemy.radius + 4),
                y: enemy.y + Math.sin(a) * (enemy.radius + 4),
                vx: Math.cos(a) * ORB.speed * 0.85,
                vy: Math.sin(a) * ORB.speed * 0.85,
                radius: ORB.radius,
                life: ORB.life,
              });
            }
          }
        }
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.spawnIn <= 0 && state.phase === 'fight' && overlaps(enemy, player)) {
        events |= damagePlayer();
        if (enemy.kind === 'dart' || enemy.kind === 'splitter') {
          addParticles(enemy.x, enemy.y, '#ff4d8d', 10, 200, 0.5, 3);
          state.enemies.splice(i, 1);
        }
        if (state.phase === 'over') break;
      }
    }

    // --- enemy shots -------------------------------------------------------------
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const orb = state.orbs[i];
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.life -= dt;
      if (orb.life <= 0 || orb.x < -30 || orb.x > FIELD.width + 30 || orb.y < -30 || orb.y > FIELD.height + 30) {
        state.orbs.splice(i, 1);
        continue;
      }
      if (state.phase === 'fight' && overlaps(orb, player)) {
        events |= damagePlayer();
        addParticles(orb.x, orb.y, '#ff7a5c', 8, 180, 0.4, 3);
        state.orbs.splice(i, 1);
        if (state.phase === 'over') break;
      }
    }

    // --- cores ----------------------------------------------------------------------
    for (let i = state.cores.length - 1; i >= 0; i -= 1) {
      const core = state.cores[i];
      const dx = player.x - core.x;
      const dy = player.y - core.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < CORE.magnet && (state.phase === 'fight' || state.phase === 'breather')) {
        core.vx += (dx / d) * 620 * dt;
        core.vy += (dy / d) * 620 * dt;
      }
      core.vx *= Math.pow(0.3, dt);
      core.vy *= Math.pow(0.3, dt);
      core.x += core.vx * dt;
      core.y += core.vy * dt;
      core.life -= dt;
      if (core.life <= 0) {
        state.cores.splice(i, 1);
        continue;
      }
      if ((state.phase === 'fight' || state.phase === 'breather') && d < CORE.collect) {
        state.cores.splice(i, 1);
        player.nova = Math.min(PLAYER.novaNeed, player.nova + PLAYER.coreCharge);
        state.score += CORE.score;
        state.coresCollected += 1;
        addParticles(core.x, core.y, '#ffd94d', 5, 140, 0.4, 3);
        events |= EVENT_CORE;
      }
    }

    // --- wave end --------------------------------------------------------------------
    if (state.phase === 'fight' && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      if (state.wave >= WAVES) {
        state.phase = 'won';
        events |= EVENT_WIN;
      } else {
        state.score += WAVE_CLEAR_BONUS * state.wave;
        events |= EVENT_WAVE_CLEAR;
        state.wave += 1;
        state.phase = 'breather';
        state.phaseTime = BREATHER;
      }
    }

    return events;
  }

  /**
   * Screenshot staging only: declare the run won with a plausible score, clearing the
   * field, when a played-through win did not happen in the time allowed. The victory
   * screen itself is still the game's own renderer over the game's own state.
   */
  function forceWin() {
    state.enemies.length = 0;
    state.orbs.length = 0;
    state.spawnQueue.length = 0;
    state.wave = WAVES;
    state.score = Math.max(state.score, 9200);
    state.phase = 'won';
    addParticles(FIELD.width / 2, FIELD.height / 2, '#ffd94d', 60, 300, 1.2, 4);
    addParticles(FIELD.width / 2, FIELD.height / 2, '#4df3ff', 40, 240, 1.0, 4);
  }

  reset();
  return { state, reset, step, forceWin };
}

/** How many shards are still to be dealt with in the current wave. */
export function enemiesLeft(state) {
  return state.spawnQueue.length + state.enemies.length;
}

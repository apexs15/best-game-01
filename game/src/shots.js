// The screenshot scenes behind ?shot=start|play|win|over. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (flee what is close, chase the nearest core, aim at the nearest shard, fire always),
// so the frame is what a short game really looks like and the same seed always gives
// the same frame. The win scene flies with a hero ship (a tougher hull, a doubled fire
// rate, the NOVA spent the moment it is full); if it still has not cleared wave 10 in
// the time allowed, the world is declared won rather than the shot left unmade.

import { FIELD, STEP } from './tuning.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const WIN_LIMIT_SECONDS = 420;
const END_LIMIT_SECONDS = 600;
/** Seconds the world settles after a win or a loss, so a NOVA flash fades and the
 * last particles drift before the frame is painted. */
const SETTLE_SECONDS = 2.5;

/** How close a threat must be before the pilot runs from it, in field units. */
const FLEE_RANGE = 170;
/** How far a core may be and still be worth chasing. */
const CORE_RANGE = 280;

/** The nearest thing of `list` to (x, y), or null. */
function nearest(list, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const item of list) {
    const dx = item.x - x;
    const dy = item.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

/**
 * One step of steering for the autopilot: a move vector, an aim point, whether to fire
 * and whether to spend the NOVA. `hero` flies the win scene and spends the NOVA the
 * moment it is full while shards remain. Exported for headless play-testing.
 */
export function autopilot(state, hero) {
  const player = state.player;
  let mx = 0;
  let my = 0;
  // Run from the closest threat.
  let threat = null;
  let threatD = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.spawnIn > 0) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.hypot(dx, dy);
    if (d < threatD) {
      threatD = d;
      threat = { dx, dy, d };
    }
  }
  for (const orb of state.orbs) {
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const d = Math.hypot(dx, dy);
    if (d < threatD) {
      threatD = d;
      threat = { dx, dy, d };
    }
  }
  if (threat !== null && threat.d < FLEE_RANGE) {
    const weight = (FLEE_RANGE - threat.d) / FLEE_RANGE;
    mx += (threat.dx / (threat.d || 1)) * weight * 2;
    my += (threat.dy / (threat.d || 1)) * weight * 2;
  }
  // Chase the nearest core when it is close and nothing is breathing down our neck.
  if (threat === null || threat.d > 110) {
    const core = nearest(state.cores, player.x, player.y);
    if (core !== null) {
      const d = Math.hypot(core.x - player.x, core.y - player.y);
      if (d < CORE_RANGE) {
        mx += ((core.x - player.x) / d) * 0.8;
        my += ((core.y - player.y) / d) * 0.8;
      }
    }
  }
  // Drift back toward the middle of the field when nothing else pulls.
  if (mx === 0 && my === 0) {
    mx = (FIELD.width / 2 - player.x) / FIELD.width;
    my = (FIELD.height / 2 - player.y) / FIELD.height;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  // Aim at the nearest shard and hold fire.
  const target = nearest(state.enemies, player.x, player.y);
  const aimX = target === null ? player.x : target.x;
  const aimY = target === null ? player.y - 100 : target.y;
  return {
    moveX: mx,
    moveY: my,
    aimX,
    aimY,
    fire: target !== null,
    nova: hero && player.nova >= 100 && state.enemies.length >= 3,
  };
}

/**
 * Set `world` to the named scene (start, play, win or over; any other name is start)
 * and return the screen to draw over it and the best score to show. `playSeconds`
 * is how long the play scene runs for; the default is the constant below.
 */
export function stageShot(name, world, playSeconds = PLAY_SECONDS) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'win' && name !== 'over') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: state.player.x, aimY: state.player.y - 100, fire: false, nova: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'over') {
    // A pilot who holds the trigger but never aims and never moves: a couple of
    // kills, then the shards close in and the ship is lost on an early wave.
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: state.player.x, aimY: state.player.y - 260, fire: true, nova: false });
      if (state.phase === 'over') break;
    }
    for (let index = 0; index < SETTLE_SECONDS / STEP; index += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: state.player.x, aimY: state.player.y - 260, fire: false, nova: false });
    }
    return { screen: SCREEN_OVER, best: state.score };
  }
  if (name === 'win') {
    state.hero = true;
    state.player.hull = 99;
    for (let index = 0; index < WIN_LIMIT_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(state, true));
      if (state.phase === 'won') break;
    }
    if (state.phase !== 'won') world.forceWin();
    for (let index = 0; index < SETTLE_SECONDS / STEP; index += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: state.player.x, aimY: state.player.y - 100, fire: false, nova: false });
    }
    return { screen: SCREEN_WIN, best: state.score };
  }
  // Play: a careful pilot, a tougher hull so the scene survives its run.
  state.hero = true;
  state.player.hull = 6;
  for (let index = 0; index < playSeconds / STEP; index += 1) {
    world.step(STEP, autopilot(state, false));
    if (state.phase === 'over' || state.phase === 'won') break;
  }
  return { screen: state.phase === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}

// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, victory and game over.
//
// ?seed=N fixes the shard pattern. ?shot=start|play|win|over (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot; &seconds=N sets how long the play scene runs for (the default is 26).

import { BEST_KEY, STEP } from './tuning.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_NOVA,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import {
  EVENT_CORE,
  EVENT_HIT,
  EVENT_KILL,
  EVENT_NOVA,
  EVENT_OVER,
  EVENT_SHOOT,
  EVENT_TICK,
  EVENT_WAVE_CLEAR,
  EVENT_WIN,
  createWorld,
} from './world.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const secondsParam = Number.parseFloat(params.get('seconds') ?? '');
const playSeconds = Number.isFinite(secondsParam) && secondsParam > 0 ? secondsParam : undefined;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, playSeconds);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Clear 10 waves.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`Victory. Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.lose();
      announce(`Ship lost on wave ${world.state.wave}. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function controls() {
    const move = input.move();
    const aim = renderer.fieldPoint(input.mouse.x, input.mouse.y);
    return { moveX: move.x, moveY: move.y, aimX: aim.x, aimY: aim.y, fire: input.firing(), nova: false };
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_TICK) audio.hit();
    if (events & EVENT_KILL) audio.explode();
    if (events & EVENT_CORE) audio.pickup();
    if (events & EVENT_NOVA) audio.nova();
    if (events & EVENT_WAVE_CLEAR) {
      audio.waveClear();
      announce(`Wave ${world.state.wave - 1} cleared.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_HIT) {
      announce(world.state.player.hull === 1 ? 'Hit. 1 hull left.' : `Hit. ${world.state.player.hull} hull left.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    const before = screen;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    // A press that changed the screen (launch, restart, resume) must not also spend
    // the NOVA in the fresh frame it opened: Space sets both bits, and the NOVA
    // belongs to play, not to the menu that just closed.
    if (screen !== before) return actions & ~ACTION_NOVA;
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire: false, nova: false }, true);
      return;
    }
    const ctl = controls();
    ctl.nova = Boolean(actions & ACTION_NOVA);
    handleEvents(world.step(STEP, ctl, false));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen !== SCREEN_PAUSED) {
      // Title and play run the full simulation; win and over keep the particles
      // drifting (the world returns early for those phases, after animating them).
      while (accumulator >= STEP && screen !== SCREEN_PAUSED) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting shards fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A handle for play-testing: the live state and screen, read-only from outside.
  window.__game = {
    get state() {
      return world.state;
    },
    get screen() {
      return screen;
    },
  };

  announce('Nova Shards. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

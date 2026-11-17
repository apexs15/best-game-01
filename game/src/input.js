// Keyboard and mouse input. Held keys give a steering vector and the mouse gives an
// aim point; one-shot presses (confirm, pause, NOVA, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_NOVA = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter', 'Space']);
const NOVA = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

/**
 * `target` is the canvas: pointer events on it aim and fire, and a click also counts
 * as confirm (so menus start on click). Returns the live input state.
 */
export function createInput(target) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, firing: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
      return;
    }
    // One-shot presses are checked independently, not in a chain: Space is in both
    // CONFIRM and NOVA (it launches from a menu and spends the NOVA in play), and
    // the loop consumes each bit on the screen it belongs to, so one press never
    // does both at once.
    if (!event.repeat) {
      if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
      if (NOVA.has(event.code)) actions |= ACTION_NOVA;
      if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
      if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    }
    if (CONFIRM.has(event.code) || NOVA.has(event.code) || PAUSE.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.firing = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouse.x = event.offsetX;
    mouse.y = event.offsetY;
  });
  target.addEventListener('pointerdown', (event) => {
    mouse.x = event.offsetX;
    mouse.y = event.offsetY;
    if (event.button === 0) {
      mouse.firing = true;
      actions |= ACTION_CONFIRM;
    } else if (event.button === 2) {
      actions |= ACTION_NOVA;
    }
    event.preventDefault();
  });
  target.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouse.firing = false;
  });
  target.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  function axis(negative, positive) {
    let value = 0;
    for (const code of negative) if (keys.has(code)) value -= 1;
    for (const code of positive) if (keys.has(code)) value += 1;
    return value;
  }

  return {
    mouse,
    /** Steering vector, each component -1, 0 or 1 (diagonals are not normalised here; the world does that). */
    move() {
      return { x: axis(LEFT, RIGHT), y: axis(UP, DOWN) };
    },
    /** Whether the fire button is held right now. */
    firing() {
      return mouse.firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

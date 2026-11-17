// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon shapes on a dark void, canvas text for the HUD and the panels.

import { CORE, FIELD, FONT, PALETTE, PLAYER, WAVES } from './tuning.js';
import { enemiesLeft } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

/** The panel's width; its height grows with its lines. */
const PANEL = { width: 640, top: 150, line: 36, bottom: 76 };
const NOVA_BAR = { width: 260, height: 12 };

function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

function grouped(number) {
  return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** One word or another by count, so the results screens read naturally. */
function plural(count, one, many) {
  return count === 1 ? one : many;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };
  const fonts = new Map();
  const trail = [];
  // The starfield: fixed positions so the void never rearranges itself.
  const stars = [];
  let seed = 1337;
  for (let i = 0; i < 110; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = (seed / 4294967296) * FIELD.width;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = (seed / 4294967296) * FIELD.height;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    stars.push({ x, y, r: 0.6 + (seed / 4294967296) * 1.5, phase: (seed / 4294967296) * Math.PI * 2 });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.ratio = ratio;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'top') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function polygon(cx, cy, radius, sides, rotation) {
    context.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const a = rotation + (i / sides) * Math.PI * 2;
      const px = cx + Math.cos(a) * radius;
      const py = cy + Math.sin(a) * radius;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  }

  function drawBackdrop(time) {
    context.fillStyle = PALETTE.space;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= FIELD.width; x += 80) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
    for (const star of stars) {
      const alpha = 0.35 + 0.3 * Math.sin(time * 1.4 + star.phase);
      context.globalAlpha = Math.max(0.08, alpha);
      context.fillStyle = PALETTE.star;
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawCores(state, time) {
    for (const core of state.cores) {
      const pulse = 1 + 0.18 * Math.sin(time * 6 + core.x);
      context.save();
      context.translate(core.x, core.y);
      context.rotate(Math.PI / 4);
      context.globalAlpha = 0.35;
      context.fillStyle = PALETTE.core;
      context.fillRect(-core.radius * pulse - 4, -core.radius * pulse - 4, (core.radius * pulse + 4) * 2, (core.radius * pulse + 4) * 2);
      context.globalAlpha = 1;
      context.fillStyle = PALETTE.core;
      context.fillRect(-core.radius * pulse, -core.radius * pulse, core.radius * pulse * 2, core.radius * pulse * 2);
      context.restore();
    }
  }

  function drawOrbs(state) {
    for (const orb of state.orbs) {
      context.globalAlpha = 0.3;
      context.fillStyle = PALETTE.orb;
      context.beginPath();
      context.arc(orb.x, orb.y, orb.radius + 5, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.beginPath();
      context.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd9c9';
      context.beginPath();
      context.arc(orb.x, orb.y, orb.radius * 0.45, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawEnemy(enemy, time) {
    const blink = enemy.spawnIn > 0 && Math.floor(time * 12) % 2 === 0;
    context.globalAlpha = blink ? 0.35 : 1;
    if (enemy.kind === 'dart') {
      const angle = Math.atan2(enemy.vy, enemy.vx);
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(angle);
      context.fillStyle = PALETTE.dart;
      context.beginPath();
      context.moveTo(enemy.radius + 4, 0);
      context.lineTo(-enemy.radius * 0.8, enemy.radius * 0.85);
      context.lineTo(-enemy.radius * 0.4, 0);
      context.lineTo(-enemy.radius * 0.8, -enemy.radius * 0.85);
      context.closePath();
      context.fill();
      context.restore();
    } else if (enemy.kind === 'hex') {
      // Flat-topped, so the six sides read as a hexagon, never as a diamond;
      // the pale rim sets it apart from the gold core diamonds.
      context.save();
      context.translate(enemy.x, enemy.y);
      context.fillStyle = PALETTE.hex;
      polygon(0, 0, enemy.radius, 6, 0);
      context.fill();
      context.strokeStyle = '#ffd27a';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#5a3a00';
      polygon(0, 0, enemy.radius * 0.45, 6, 0);
      context.fill();
      context.restore();
    } else if (enemy.kind === 'splitter') {
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(enemy.angle);
      context.fillStyle = PALETTE.splitter;
      polygon(0, 0, enemy.radius, 4, 0);
      context.fill();
      context.fillStyle = '#2c1155';
      polygon(0, 0, enemy.radius * 0.45, 4, 0);
      context.fill();
      context.restore();
    } else {
      // The Warden: a big pentagon with a health ring.
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(enemy.angle * 0.25);
      context.fillStyle = PALETTE.warden;
      polygon(0, 0, enemy.radius, 5, -Math.PI / 2);
      context.fill();
      context.fillStyle = '#571505';
      polygon(0, 0, enemy.radius * 0.5, 5, -Math.PI / 2);
      context.fill();
      context.restore();
      const fraction = Math.max(0, enemy.hp / enemy.maxHp);
      context.fillStyle = '#3a0d04';
      context.fillRect(enemy.x - 34, enemy.y - enemy.radius - 16, 68, 6);
      context.fillStyle = PALETTE.warden;
      context.fillRect(enemy.x - 34, enemy.y - enemy.radius - 16, 68 * fraction, 6);
    }
    context.globalAlpha = 1;
  }

  function drawBullets(state) {
    context.strokeStyle = PALETTE.bullet;
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.beginPath();
    for (const bullet of state.bullets) {
      const back = 0.016;
      context.moveTo(bullet.x - bullet.vx * back, bullet.y - bullet.vy * back);
      context.lineTo(bullet.x, bullet.y);
    }
    context.stroke();
  }

  function drawShip(state, time) {
    const player = state.player;
    if (player.invulnerable > 0 && Math.floor(time * 12) % 2 === 0) return;
    const speed = Math.hypot(player.vx, player.vy);
    // Engine flame, longer the faster the ship flies.
    const flame = 10 + Math.min(22, speed * 0.05) * (0.8 + 0.2 * Math.sin(time * 40));
    context.save();
    context.translate(player.x, player.y);
    context.rotate(player.angle);
    context.fillStyle = '#ff9a3c';
    context.globalAlpha = 0.85;
    context.beginPath();
    context.moveTo(-player.radius * 0.7, 5);
    context.lineTo(-player.radius * 0.7 - flame, 0);
    context.lineTo(-player.radius * 0.7, -5);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(player.radius + 6, 0);
    context.lineTo(-player.radius * 0.8, player.radius * 0.85);
    context.lineTo(-player.radius * 0.35, 0);
    context.lineTo(-player.radius * 0.8, -player.radius * 0.85);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(2, 0, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // A fading trail of where the ship has been.
    trail.push({ x: player.x, y: player.y, angle: player.angle, life: 0.28 });
    if (trail.length > 14) trail.shift();
    for (let i = 0; i < trail.length; i += 1) {
      const ghost = trail[i];
      ghost.life -= 1 / 60;
      if (ghost.life <= 0) continue;
      context.save();
      context.translate(ghost.x, ghost.y);
      context.rotate(ghost.angle);
      context.globalAlpha = ghost.life * 0.9;
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.moveTo(6, 0);
      context.lineTo(-8, 7);
      context.lineTo(-8, -7);
      context.closePath();
      context.fill();
      context.restore();
    }
    context.globalAlpha = 1;
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
  }

  function drawFloats(state) {
    for (const f of state.floats) {
      context.globalAlpha = Math.max(0, f.life / 0.9);
      text(f.text, f.x, f.y, 18, f.color, 'center');
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, time) {
    const player = state.player;
    // A dim backing behind the top text, so a bullet or a star never shows through
    // the gaps of a glyph and reads as a glitch in the HUD.
    context.fillStyle = 'rgba(5, 7, 15, 0.55)';
    context.fillRect(10, 8, 330, 74);
    context.fillRect(FIELD.width / 2 - 170, 8, 340, 74);
    text(`SCORE ${grouped(state.score)}`, 24, 18, 28, PALETTE.text);
    if (state.multiplier > 1) {
      text(`x${state.multiplier} COMBO`, 24, 52, 20, PALETTE.core);
    }
    text(`WAVE ${state.wave}/${WAVES}`, FIELD.width / 2, 18, 28, PALETTE.text, 'center');
    text(
      state.phase === 'breather' ? `NEXT WAVE IN ${Math.ceil(state.phaseTime)}` : `${enemiesLeft(state)} SHARDS LEFT`,
      FIELD.width / 2,
      52,
      18,
      PALETTE.muted,
      'center',
    );
    // Hull as small ships, top right.
    const hullSize = 15;
    const hullGap = 8;
    const firstHull = FIELD.width - 24 - PLAYER.hull * (hullSize + hullGap) + hullGap;
    for (let i = 0; i < PLAYER.hull; i += 1) {
      const cx = firstHull + i * (hullSize + hullGap) + hullSize / 2;
      const cy = 30;
      context.save();
      context.translate(cx, cy);
      context.rotate(-Math.PI / 2);
      context.fillStyle = i < player.hull ? PALETTE.player : '#2a3450';
      context.beginPath();
      context.moveTo(hullSize / 2 + 2, 0);
      context.lineTo(-hullSize / 2, hullSize / 2);
      context.lineTo(-hullSize / 2, -hullSize / 2);
      context.closePath();
      context.fill();
      context.restore();
    }
    // NOVA bar, bottom centre.
    const barX = (FIELD.width - NOVA_BAR.width) / 2;
    const barY = FIELD.height - 34;
    const full = player.nova >= PLAYER.novaNeed;
    const pulse = full ? 0.75 + 0.25 * Math.sin(time * 8) : 1;
    context.globalAlpha = pulse;
    text(full ? 'NOVA READY — SPACE' : 'NOVA', barX - 12, barY - 2, 16, full ? PALETTE.nova : PALETTE.muted, 'right');
    context.globalAlpha = 1;
    context.fillStyle = '#1a2440';
    context.fillRect(barX, barY, NOVA_BAR.width, NOVA_BAR.height);
    context.fillStyle = full ? PALETTE.nova : PALETTE.core;
    context.fillRect(barX, barY, NOVA_BAR.width * (player.nova / PLAYER.novaNeed), NOVA_BAR.height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(barX, barY, NOVA_BAR.width, NOVA_BAR.height);
    if (state.time < 9 && state.wave === 1 && state.phase === 'fight') {
      text('WASD move · Mouse aim · Hold click to fire · Space = NOVA', FIELD.width / 2, FIELD.height - 64, 18, PALETTE.muted, 'center');
    }
  }

  function drawPanel(title, lines, prompt, titleColor = PALETTE.text) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 52, titleColor, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.core, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    const time = state.time;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawBackdrop(time);
    drawCores(state, time);
    drawOrbs(state);
    for (const enemy of state.enemies) drawEnemy(enemy, time);
    drawBullets(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_WIN) drawShip(state, time);
    drawParticles(state);
    drawFloats(state);
    if (state.flash > 0) {
      context.globalAlpha = state.flash * 0.55;
      context.fillStyle = '#dff8ff';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.globalAlpha = 1;
    }
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Clear all 10 waves. Feed the NOVA.',
        'WASD move · Mouse aim · Hold click to fire',
        'Space = NOVA when the bar is full · P pauses · M mutes',
        `Best ${grouped(best)}`,
      ];
      drawPanel('NOVA SHARDS', lines, 'Press Space or click to launch');
      return;
    }
    drawHud(state, time);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The shards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_WIN) {
      const accuracy = state.stats.shots > 0 ? Math.round((100 * state.stats.hits) / state.stats.shots) : 0;
      const lines = [
        'All 10 waves cleared. The belt is quiet.',
        `Score ${grouped(state.score)}   ·   Best ${grouped(best)}`,
        `${state.kills} ${plural(state.kills, 'shard', 'shards')} down   ·   ${accuracy}% accuracy   ·   ${formatTime(state.time)}`,
      ];
      drawPanel('VICTORY', lines, 'Press Space or click to fly again', PALETTE.core);
    } else if (screen === SCREEN_OVER) {
      const lines = [
        `The shards take wave ${state.wave}.`,
        `Score ${grouped(state.score)}   ·   Best ${grouped(best)}`,
        `${state.kills} ${plural(state.kills, 'shard', 'shards')} down   ·   ${state.coresCollected} ${plural(state.coresCollected, 'core', 'cores')} gathered`,
      ];
      drawPanel('SHIP LOST', lines, 'Press Space or click to try again', PALETTE.danger);
    }
  }

  /** Canvas CSS pixels (event.offsetX/Y) into field coordinates. */
  function fieldPoint(cssX, cssY) {
    return {
      x: (cssX * view.ratio - view.x) / view.scale,
      y: (cssY * view.ratio - view.y) / view.scale,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, fieldPoint };
}

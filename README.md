# Nova Shards — best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/apexs15/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/apexs15/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A neon arena wave shooter, built from scratch in plain 2D canvas. You pilot
the last starship of the Shard Belt against waves of living geometry: darts
that hunt you, hexes that shoot back, splitters that break in two, and the
Warden that guards the tenth wave. Every kill drops a core; cores charge your
NOVA, a blast that clears the screen. Clear all 10 waves to win.

## How to play

- **Move:** WASD or arrow keys (the ship has real inertia — drift, don't jerk)
- **Aim:** mouse
- **Fire:** hold the left mouse button
- **NOVA:** Space (or right-click) when the NOVA bar is full
- **Pause:** P or Esc — **Mute:** M
- **Start / restart:** Space, Enter, or click

Kills chain a combo multiplier (up to x5) while you keep killing within 2
seconds. Wave 5 and wave 10 bring a Warden. Hull takes 3 hits; a hit makes
you briefly invulnerable.

## The entry

- `game/` — the whole game as static files, no network requests, no libraries
  - `index.html` — the page, one canvas
  - `src/tuning.js` — every number and colour in one place
  - `src/random.js` — seeded random numbers
  - `src/audio.js` — synthesised sound effects (WebAudio, no audio files)
  - `src/input.js` — keyboard and mouse
  - `src/world.js` — the rules: ship, shards, waves, cores, NOVA, score
  - `src/render.js` — canvas drawing: field, HUD, title / pause / win / over
  - `src/shots.js` — screenshot staging (plays the real rules with an autopilot)
  - `src/main.js` — boot, the fixed-step loop, screens
- `main.ts` — the program that hands the game in (copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`)
- `screenshots/` — real renders of the game: cover (mid-play), title, victory,
  game over

Play it locally: serve `game/` with any static server and open `index.html`.

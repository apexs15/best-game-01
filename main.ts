// Nova Shards, handed in by its program: the game lives in this directory as plain
// static files (game/index.html and its ES modules, no library, no network), and this
// program copies game/ and screenshots/ next to /output and writes /output/dossier.json
// with the make.fun library vendored under vendor/. Node 22 standard library only.
//
// Play it locally by serving game/ with any static server and opening index.html.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The caps the scorer enforces: the dossier text cap shapes the bytes, the rest refuse. */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function main(): void {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  mkdirSync(outDir, { recursive: true });
  cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(join(root, 'screenshots'))) {
    cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);

  // Read the dossier back and check it is what the library wrote: the schema tag
  // and one image per screenshot. A mismatch here means the output directory was
  // tampered with between the build and the write, and the entry must not go out.
  const written = JSON.parse(readFileSync(dossierPath, 'utf8')) as {
    schema?: unknown;
    images?: unknown[];
  };
  if (written.schema !== 'makefun/dossier/v1') {
    throw new Error(`nova-shards: dossier.json has schema ${String(written.schema)}, not makefun/dossier/v1`);
  }
  const shots = readdirSync(join(outDir, 'screenshots'))
    .filter((name) => !name.startsWith('.'))
    .sort();
  if (!Array.isArray(written.images) || written.images.length !== shots.length) {
    throw new Error(`nova-shards: dossier holds ${written.images?.length ?? 0} images for ${shots.length} screenshots`);
  }
  const shotBytes = shots.reduce((sum, name) => sum + statSync(join(outDir, 'screenshots', name)).size, 0);
  console.log(`nova-shards: dossier ${dossier.length} bytes, ${shots.length} screenshots (${shotBytes} bytes)`);
}

main();

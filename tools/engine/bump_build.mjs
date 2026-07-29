/**
 * Bump the engine's build stamp. Run this before every deploy.
 *
 * WHY IT MATTERS: GitHub Pages serves the engine with a hard-coded
 * `Cache-Control: max-age=600` that the repo cannot change, and the engine
 * has no build step to hash filenames. `engine/index.html` therefore
 * versions every module and data URL from one constant, and that constant
 * has to move or a deploy is invisible for ten minutes — which is exactly
 * how a shipped fix looked like a broken one.
 *
 * Stamps read `YYYY-MM-DDx`, so several deploys in a day stay ordered.
 *
 *   node tools/engine/bump_build.mjs           # today, next letter
 *   node tools/engine/bump_build.mjs --print   # just show the current one
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const INDEX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../engine/index.html');
const src = fs.readFileSync(INDEX, 'utf8');
const RE = /var AMG_BUILD = '([^']+)';/;
const found = src.match(RE);
if (!found) {
  console.error('could not find `var AMG_BUILD` in engine/index.html');
  process.exit(1);
}
const current = found[1];

if (process.argv.includes('--print')) {
  console.log(current);
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
let next;
if (current.startsWith(today)) {
  // same day: walk the suffix on a → b → c …
  const suffix = current.slice(today.length) || 'a';
  next = today + String.fromCharCode(suffix.charCodeAt(0) + 1);
} else {
  next = today + 'a';
}

fs.writeFileSync(INDEX, src.replace(RE, `var AMG_BUILD = '${next}';`));
console.log(`build ${current} → ${next}`);

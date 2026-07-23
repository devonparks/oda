/** Verify all 16 v2 GLBs share ONE skeleton (the emote bins assume it). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGLB } from './emote_lab.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BONES = JSON.parse(fs.readFileSync(path.join(ROOT, 'world', 'assets', 'locomotion.json'))).bones;
const dir = path.join(ROOT, 'assets', 'characters', 'v2');
const ref = parseGLB(path.join(dir, 'kid_hoodie.glb'));
let allOk = true;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.glb'))) {
  const g = parseGLB(path.join(dir, f));
  let worstQ = 0, worstT = 0, missing = 0;
  for (const b of BONES) {
    const a = ref.byName[b], c = g.byName[b];
    if (!a || !c) { missing++; continue; }
    for (let i = 0; i < 4; i++) worstQ = Math.max(worstQ, Math.abs(a.q[i] - c.q[i]));
    for (let i = 0; i < 3; i++) worstT = Math.max(worstT, Math.abs(a.t[i] - c.t[i]));
  }
  const ok = missing === 0 && worstQ < 1e-4 && worstT < 1e-3;
  if (!ok) allOk = false;
  console.log((ok ? '  ok  ' : '  DIFF') + ' ' + f.padEnd(22) + ' missing:' + missing + ' worstQ:' + worstQ.toExponential(1) + ' worstT:' + worstT.toExponential(1));
}
console.log(allOk ? 'ALL SKELETONS IDENTICAL ✓' : 'MISMATCH — per-character bins would be needed');
process.exit(allOk ? 0 : 1);

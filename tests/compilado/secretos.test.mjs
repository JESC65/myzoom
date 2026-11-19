// dist/ must never contain the synthetic secrets of the test and mock modes (section 6).
// Run after `npm run build`: npm run test:dist (folder not named dist/ because .gitignore ignores it)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_SECRETS } from '../e2e/test-env.mjs';
import { SECRETS as UNIT_SECRETS } from '../worker/helpers.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');

function devVarsValues(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n')
    .map((l) => /^\s*(CF_API_TOKEN|HOST_SECRET|INVITE_CODE)\s*=\s*"?([^"\n]*)"?\s*$/.exec(l))
    .filter(Boolean).map((m) => m[2].trim()).filter((v) => v.length >= 6);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

describe('dist/ sin secretos', () => {
  it('existe dist/client (ejecuta npm run build antes)', () => {
    assert.ok(fs.existsSync(path.join(DIST, 'client', 'index.html')), 'falta dist/client/index.html');
  });

  it('ningún archivo de dist/ contiene secretos sintéticos ni los de .dev.vars', () => {
    const needles = [
      ...Object.values(E2E_SECRETS), ...Object.values(UNIT_SECRETS),
      ...devVarsValues(path.join(ROOT, '.dev.vars.example')), ...devVarsValues(path.join(ROOT, '.dev.vars')),
    ];
    assert.ok(needles.length >= 9); // variable NAMES may appear in messages; only values are secret
    const hits = [];
    for (const file of walk(DIST)) {
      const text = fs.readFileSync(file).toString('latin1');
      for (const n of needles) if (text.includes(n)) hits.push(`${path.relative(ROOT, file)} contiene ${n.length > 12 ? n.slice(0, 6) + '…' : n}`);
    }
    assert.deepEqual(hits, []);
  });
});

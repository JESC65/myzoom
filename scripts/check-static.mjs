#!/usr/bin/env node
// scripts/check-static.mjs · Project-specific static checks (part of `npm run check`, after tsc).
// Fails if a rule of the brief (encargo) is broken in the source tree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|mjs|js|css|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

const srcFiles = walk(path.join(ROOT, 'src'));
for (const file of srcFiles) {
  const r = rel(file);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const at = `${r}:${i + 1}`;
    if (/\b(localStorage|sessionStorage)\b/.test(line) && r !== 'src/client/storage.ts') problems.push(`${at} usa almacenamiento del navegador fuera de src/client/storage.ts (5.1, 4.5)`);
    if (/\beval\s*\(|new Function\s*\(/.test(line)) problems.push(`${at} usa eval o new Function`);
    if (r.startsWith('src/worker/') && /console\.(log|info|debug)\s*\(/.test(line)) problems.push(`${at} usa console.log en el Worker: solo console.error con texto fijo`);
    if (/console\.\w+\([^)]*\b(token|authToken|clave|hostSecret|inviteCode|codigo|nombre|ciudad|cfApiToken)\b/.test(line)) problems.push(`${at} parece registrar un dato sensible (6)`);
    if (/\b(MediaRecorder|serviceWorker|BroadcastChannel|R2Bucket|KVNamespace|DurableObject|webmanifest)\b/.test(line)) problems.push(`${at} contiene algo fuera de alcance (3.2)`);
  });
}

if (fs.existsSync(path.join(ROOT, '.github', 'workflows'))) problems.push('.github/workflows existe: no se crea integración continua en esta versión (10.2)');

const wrangler = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
let cfg = null;
try { cfg = JSON.parse(wrangler); } catch { problems.push('wrangler.jsonc no se pudo leer (¿comentarios al final de línea?)'); }
if (cfg) {
  if (cfg.keep_vars !== true) problems.push('wrangler.jsonc debe tener "keep_vars": true (4.1)');
  const vars = Object.keys(cfg.vars ?? {});
  if (vars.length !== 1 || cfg.vars.MOCK_RTK !== 'false') problems.push('wrangler.jsonc solo puede definir vars.MOCK_RTK = "false" (4.1)');
  if (cfg.assets?.binding !== 'ASSETS' || cfg.assets?.run_worker_first !== true) problems.push('wrangler.jsonc: assets.binding = "ASSETS" y run_worker_first = true son necesarios (respaldo y cabeceras)');
}

const tracked = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
if (tracked.status === 0) {
  for (const f of tracked.stdout.split('\n')) {
    if (/(^|\/)\.dev\.vars$|(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.example')) problems.push(`${f} está en Git: los secretos no se suben (6)`);
    if (/^(node_modules|dist|logs)\//.test(f)) problems.push(`${f} está en Git y no debería`);
  }
}

if (problems.length) {
  console.error(`❌ Revisión estática: ${problems.length} problema(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`✅ Revisión estática: sin problemas (${srcFiles.length} archivos de src/ revisados).`);

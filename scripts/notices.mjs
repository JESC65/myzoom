#!/usr/bin/env node
// scripts/notices.mjs · Writes THIRD_PARTY_NOTICES.md from package-lock.json and node_modules.
// Lists production dependencies (shipped to browsers or the Worker) and flags non-permissive licenses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const PERMISSIVE = /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|0BSD|Apache-2\.0|BlueOak-1\.0\.0|CC0-1\.0|Unlicense|MIT-0|Python-2\.0)$/;
// Cloudflare's own SDK is explicitly allowed by the brief (section 6) even without a license field.
const ALLOWED_VENDOR = /^@cloudflare\/realtimekit/;

function licenseOf(meta) {
  const l = meta.license ?? meta.licenses;
  if (!l) return null;
  if (typeof l === 'string') return l;
  if (Array.isArray(l)) return l.map((x) => (typeof x === 'string' ? x : x.type)).join(' OR ');
  return l.type ?? null;
}

const rows = [];
for (const [key, entry] of Object.entries(lock.packages ?? {})) {
  if (!key.startsWith('node_modules/') || entry.dev) continue;
  const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(path.join(ROOT, key, 'package.json'), 'utf8')); } catch { /* not installed */ }
  let license = licenseOf(meta) ?? entry.license ?? null;
  if (!license) {
    // Some packages ship only a LICENSE file: read its first line.
    for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
      try {
        const first = fs.readFileSync(path.join(ROOT, key, f), 'utf8').trim().split('\n')[0] ?? '';
        if (/^MIT License/i.test(first)) license = 'MIT (según su archivo LICENSE)';
        else if (/^ISC License/i.test(first)) license = 'ISC (según su archivo LICENSE)';
        else if (/Apache License/i.test(first)) license = 'Apache-2.0 (según su archivo LICENSE)';
        if (license) break;
      } catch { /* no file */ }
    }
  }
  const parts = (license ?? '').replace(/\s*\(según su archivo LICENSE\)/, '').replace(/[()]/g, '').split(/\s+(?:OR|AND)\s+/);
  const ok = license ? parts.some((p) => PERMISSIVE.test(p.trim())) : false;
  const status = ok ? 'permisiva' : ALLOWED_VENDOR.test(name) ? 'SDK de Cloudflare (permitido por el encargo)' : 'REVISAR';
  rows.push({ name, version: entry.version ?? meta.version ?? '?', license: license ?? 'sin campo license', status, repo: typeof meta.repository === 'string' ? meta.repository : meta.repository?.url ?? meta.homepage ?? '' });
}
rows.sort((a, b) => a.name.localeCompare(b.name));
const review = rows.filter((r) => r.status === 'REVISAR');

const md = [
  '# Avisos de terceros · THIRD_PARTY_NOTICES',
  '',
  `Generado por \`npm run notices\` (scripts/notices.mjs) a partir de \`package-lock.json\`. Fecha: ${new Date().toISOString().slice(0, 10)}.`,
  '',
  'Incluye solo las dependencias de producción: las que viajan al navegador o al Worker. Las herramientas de desarrollo (Vite, Wrangler, TypeScript, Playwright, axe-core) no se distribuyen.',
  '',
  `Total: ${rows.length} paquetes · a revisar: ${review.length}.`,
  '',
  '| Paquete | Versión | Licencia | Estado | Origen |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| \`${r.name}\` | ${r.version} | ${r.license} | ${r.status} | ${r.repo.replace(/^git\+/, '').replace(/\|/g, '')} |`),
  '',
  'Los textos completos de cada licencia están en `node_modules/<paquete>/LICENSE` tras `npm ci`.',
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), md);
console.log(`✅ THIRD_PARTY_NOTICES.md: ${rows.length} paquetes de producción; a revisar: ${review.length}.`);
for (const r of review) console.log(`  ⚠️ ${r.name}@${r.version}: ${r.license}`);

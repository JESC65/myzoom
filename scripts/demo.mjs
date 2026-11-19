#!/usr/bin/env node
// scripts/demo.mjs · Starts MyZoom locally in mock mode (MOCK_RTK=true) with synthetic values,
// using the real Workers runtime (wrangler dev, local). Never fakes a service it did not start.
//
// Uso: npm run demo [-- --puerto 8787] [-- --sin-build]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const portArg = args.indexOf('--puerto');
const PORT = portArg >= 0 ? Number(args[portArg + 1]) : 8787;
const SKIP_BUILD = args.includes('--sin-build');
const IS_WIN = process.platform === 'win32';
const bin = (name) => path.join(ROOT, 'node_modules', '.bin', IS_WIN ? `${name}.cmd` : name);

// Synthetic values for the rehearsal only (same as .dev.vars.example).
const DEMO = {
  MOCK_RTK: 'true',
  CF_API_TOKEN: 'ensayo-token-no-real',
  HOST_SECRET: 'ensayo-clave-anfitrion-0000',
  INVITE_CODE: 'ensayo81',
  CF_ACCOUNT_ID: 'ensayo-cuenta',
  RTK_APP_ID: 'ensayo-app',
  RTK_MEETING_ID: 'ensayo-reunion',
  PRESET_GUEST: 'group_call_participant',
  PRESET_HOST: 'group_call_host',
  EVENT_OPENS_AT: '2026-01-01T00:00:00-05:00',
  EVENT_CLOSES_AT: '2099-12-31T23:00:00-05:00',
  FALLBACK_URL: '',
  HOST_DISPLAY_NAME: 'Salón · Promoción 81',
};

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) fail('El puerto debe ser un número entre 1024 y 65535.');
if (!fs.existsSync(bin('wrangler')) || !fs.existsSync(bin('vite'))) fail('Faltan las dependencias. Ejecuta primero: npm ci');

if (!SKIP_BUILD || !fs.existsSync(path.join(ROOT, 'dist', 'client', 'index.html'))) {
  console.log('▶ Compilando la aplicación (vite build)…');
  const b = spawnSync(bin('vite'), ['build', '--logLevel', 'warn'], { cwd: ROOT, stdio: 'inherit', shell: IS_WIN });
  if (b.status !== 0) fail('La compilación falló. Revisa el mensaje de arriba.');
}

// Variables go in a temporary env file inside .wrangler/ (ignored by Git). It overrides .dev.vars.
const envDir = path.join(ROOT, '.wrangler');
fs.mkdirSync(envDir, { recursive: true });
const envFile = path.join(envDir, 'demo.env');
fs.writeFileSync(envFile, Object.entries(DEMO).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n');

console.log(`▶ Arrancando el Worker local en el puerto ${PORT} (wrangler dev)…`);
const child = spawn(bin('wrangler'), ['dev', '--local', '--ip', '127.0.0.1', '--port', String(PORT), '--env-file', envFile, '--show-interactive-dev-session=false'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: IS_WIN,
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' },
});
let log = '';
child.stdout.on('data', (d) => { log += d; });
child.stderr.on('data', (d) => { log += d; });

let exited = false;
child.on('exit', (code) => {
  exited = true;
  if (!ready) {
    console.error(log.split('\n').slice(-25).join('\n'));
    fail(`wrangler dev terminó antes de estar listo (código ${code}).`);
  }
  process.exit(code ?? 0);
});

const stop = () => { if (!exited) child.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

let ready = false;
const started = Date.now();
while (!ready && !exited && Date.now() - started < 90_000) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/estado`);
    const j = await r.json();
    if (j.modo === 'ensayo') ready = true;
    else fail('El Worker respondió, pero no está en modo ensayo. Revisa .dev.vars.');
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!ready) {
  console.error(log.split('\n').slice(-25).join('\n'));
  stop();
  fail('wrangler dev no respondió en 90 segundos.');
}

console.log(`
✅ MyZoom en modo ensayo está listo (nada de esto es una sala real).

  Invitado:   http://localhost:${PORT}/?c=${DEMO.INVITE_CODE}
  Anfitrión:  http://localhost:${PORT}/anfitrion
  Código de invitación (ensayo): ${DEMO.INVITE_CODE}
  Clave del anfitrión (ensayo): ${DEMO.HOST_SECRET}

  Para detenerlo: Ctrl + C
`);

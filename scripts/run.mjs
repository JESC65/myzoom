#!/usr/bin/env node
// scripts/run.mjs · v1.1 · Ejecuta un comando largo sin que la sesión se cuelgue.
//
// Uso:   node scripts/run.mjs [opciones] -- comando argumentos...
//   --nombre X     nombre corto para el registro (por defecto, sale del comando)
//   --limite S     segundos máximos; al vencer, termina el comando y todos sus procesos.
//                  Por defecto, 30 s menos que BASH_DEFAULT_TIMEOUT_MS (570 s si no está). 0 = sin límite.
//   --cola N       líneas finales que se muestran al terminar (por defecto 40)
//   --todo         además muestra toda la salida mientras corre (gasta más contexto)
//
// Qué hace: cierra la entrada del teclado (nada puede quedarse esperando una respuesta),
// guarda la salida completa en logs/AAAAMMDD-HHMMSS-<nombre>.log, agrega una línea a
// logs/ejecuciones.jsonl y al final imprime un resumen en español.
// Código de salida: el del comando; 124 si se agotó el tiempo; 127 si el comando no existe.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

// Raíz del repositorio: la carpeta que contiene scripts/, desde donde sea que se llame.
const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';
const LOGS = path.join(ROOT, 'logs');
const MAX_LOG_BYTES = 20 * 1024 * 1024;
const MAX_LOG_FILES = 300;
const PROMPT_RE = /(\?\s*$|\(y\/n\)|\[y\/n\]|\(s\/n\)|password:|contraseña:|passphrase|press any key|presione una tecla|continue\?)/i;

function usage(msg) {
  if (msg) console.log(msg);
  console.log('Uso: node scripts/run.mjs [--nombre X] [--limite segundos] [--cola N] [--todo] -- comando argumentos...');
  process.exit(2);
}

// ---------- argumentos ----------
const argv = process.argv.slice(2);
const opts = { nombre: '', limite: null, cola: 40, todo: false };
let i = 0;
for (; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--') { i++; break; }
  if (a === '--nombre') opts.nombre = argv[++i] || '';
  else if (a === '--limite') opts.limite = Number(argv[++i]);
  else if (a === '--cola') opts.cola = Number(argv[++i]);
  else if (a === '--todo') opts.todo = true;
  else if (a.startsWith('--')) usage(`Opción desconocida: ${a}`);
  else break;
}
const cmdArgs = argv.slice(i);
if (cmdArgs.length === 0) usage('Falta el comando.');
if (opts.limite === null) {
  const bash = Number(process.env.BASH_DEFAULT_TIMEOUT_MS);
  opts.limite = Number.isFinite(bash) && bash > 60000 ? Math.floor(bash / 1000) - 30 : 570;
}
if (!Number.isFinite(opts.limite) || opts.limite < 0) usage('--limite debe ser un número de segundos (0 = sin límite).');
if (!Number.isFinite(opts.cola) || opts.cola < 0) opts.cola = 40;

// ---------- utilidades ----------
function stamp(d = new Date()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`;
  } catch {
    return d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  }
}
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'comando';
const shown = (args) => args.map((a) => (/[\s"'$`]/.test(a) ? JSON.stringify(a) : a)).join(' ');
const secs = (ms) => (ms < 90000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`);

// Pares [pid, ppid] de todos los procesos: con `ps` y, si no está, leyendo /proc (Linux).
function processTable() {
  const r = spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8', timeout: 5000 });
  if (!r.error && r.stdout) return r.stdout.split('\n').map((l) => l.trim().split(/\s+/).map(Number));
  const pairs = [];
  try {
    for (const d of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(d)) continue;
      try {
        const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8');
        pairs.push([Number(d), Number(st.slice(st.lastIndexOf(')') + 2).split(' ')[1])]);
      } catch { /* el proceso terminó mientras se leía */ }
    }
  } catch { /* sin /proc */ }
  return pairs;
}
function descendants(pid) {
  const kids = new Map();
  for (const [p, pp] of processTable()) {
    if (!p) continue;
    if (!kids.has(pp)) kids.set(pp, []);
    kids.get(pp).push(p);
  }
  const all = []; const queue = [pid];
  while (queue.length) {
    const cur = queue.shift();
    for (const k of kids.get(cur) || []) { all.push(k); queue.push(k); }
  }
  return all;
}
function killTree(pid) {
  if (!pid) return;
  if (IS_WIN) { spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { timeout: 10000 }); return; }
  const tree = [pid, ...descendants(pid)];
  for (const p of tree) { try { process.kill(p, 'SIGTERM'); } catch { /* ya terminó */ } }
  // En Linux, un proceso ya terminado puede seguir listado como «zombi» hasta que lo recojan: no cuenta como vivo.
  const zombie = (p) => {
    try { const st = fs.readFileSync(`/proc/${p}/stat`, 'utf8'); const i = st.lastIndexOf(')'); return st.slice(i + 2, i + 3) === 'Z'; }
    catch { return false; }
  };
  const alive = () => tree.some((p) => { try { process.kill(p, 0); } catch { return false; } return !zombie(p); });
  const pause = new Int32Array(new SharedArrayBuffer(4));
  const until = Date.now() + 3000;
  while (Date.now() < until && alive()) Atomics.wait(pause, 0, 0, 200);
  for (const p of tree) { try { process.kill(p, 'SIGKILL'); } catch { /* ya terminó */ } }
}
function pruneLogs() {
  try {
    const files = fs.readdirSync(LOGS).filter((f) => f.endsWith('.log')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - MAX_LOG_FILES))) fs.rmSync(path.join(LOGS, f), { force: true });
  } catch { /* sin carpeta */ }
}

// ---------- ejecución ----------
fs.mkdirSync(LOGS, { recursive: true });
pruneLogs();
const nombre = slug(opts.nombre || cmdArgs.slice(0, 3).map((a) => path.basename(a)).join('-'));
const inicio = new Date();
const logRel = path.join('logs', `${stamp(inicio)}-${nombre}.log`).replace(/\\/g, '/');
const logPath = path.join(ROOT, logRel);
const log = fs.createWriteStream(logPath, { flags: 'a' });
let logBytes = 0; let logCut = false;
log.write(`# ${shown(cmdArgs)}\n# carpeta: ${process.cwd()}\n# inicio: ${inicio.toISOString()} · límite: ${opts.limite || 'sin límite'} s\n\n`);

const tail = []; let partial = '';
function onData(chunk, stream) {
  const text = chunk.toString('utf8');
  if (!logCut) {
    logBytes += chunk.length;
    if (logBytes > MAX_LOG_BYTES) { logCut = true; log.write('\n[registro recortado: superó 20 MB; abajo solo queda el resumen]\n'); }
    else log.write(chunk);
  }
  if (opts.todo) stream.write(chunk);
  const parts = (partial + text).split(/\r?\n|\r/);
  partial = parts.pop();
  for (const l of parts) { tail.push(l); if (tail.length > Math.max(opts.cola, 1) + 200) tail.splice(0, 200); }
  lastOutput = Date.now();
}

const env = {
  ...process.env,
  CI: '1', npm_config_yes: 'true', npm_config_fund: 'false', npm_config_progress: 'false',
  GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', PAGER: 'cat', DEBIAN_FRONTEND: 'noninteractive',
  NO_COLOR: '1', FORCE_COLOR: '0',
};
let lastOutput = Date.now();
let reason = null; // 'tiempo' | 'esperaba' | 'senal'
let finished = false;
let leftovers = false;
const timers = [];
// En Windows hace falta la consola para npm.cmd y similares; ahí cada argumento con espacios va entre comillas.
const winQuote = (a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const child = IS_WIN
  ? spawn(cmdArgs.map(winQuote).join(' '), [], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'], shell: true, windowsHide: true })
  : spawn(cmdArgs[0], cmdArgs.slice(1), { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', (c) => onData(c, process.stdout));
child.stderr.on('data', (c) => onData(c, process.stderr));

if (opts.limite > 0) {
  timers.push(setTimeout(() => { reason = 'tiempo'; killTree(child.pid); }, opts.limite * 1000));
}
timers.push(setInterval(() => {
  const last = (partial || tail[tail.length - 1] || '').trim();
  if (Date.now() - lastOutput > 120000 && PROMPT_RE.test(last)) { reason = 'esperaba'; killTree(child.pid); }
}, 10000));
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(sig, () => { reason = reason || 'senal'; killTree(child.pid); });
}

let spawnError = null;
child.on('error', (e) => { spawnError = e; });
child.on('close', (code, signal) => finish({ code, signal, error: spawnError }));
// Si el comando terminó pero dejó un proceso hijo con la salida abierta, no esperamos por él.
child.on('exit', (code, signal) => {
  timers.push(setTimeout(() => {
    leftovers = true;
    child.stdout.destroy(); child.stderr.destroy();
    finish({ code, signal, error: spawnError });
  }, 5000));
});

function finish({ code, signal, error }) {
  if (finished) return;
  finished = true;
  for (const t of timers) clearTimeout(t);
  if (partial) { tail.push(partial); partial = ''; }
  const ms = Date.now() - inicio.getTime();
  const notFound = error && error.code === 'ENOENT';
  let resultado; let exitCode;
  if (notFound) { resultado = 'no_existe'; exitCode = 127; }
  else if (reason === 'tiempo') { resultado = 'tiempo'; exitCode = 124; }
  else if (reason === 'esperaba') { resultado = 'esperaba_respuesta'; exitCode = 124; }
  else if (reason === 'senal') { resultado = 'interrumpido'; exitCode = 130; }
  else if (error) { resultado = 'falla'; exitCode = 1; }
  else if (code === 0) { resultado = 'ok'; exitCode = 0; }
  else { resultado = 'falla'; exitCode = code ?? (signal ? 128 + (({ SIGKILL: 9, SIGTERM: 15, SIGINT: 2 })[signal] || 1) : 1); }

  const cmdText = shown(cmdArgs);
  const cola = tail.filter((l, idx) => l.trim() || idx === tail.length - 1).slice(-opts.cola);
  const lines = [];
  if (resultado === 'ok') {
    lines.push(`✅ Terminó bien: ${cmdText} (${secs(ms)}) · registro: ${logRel}`);
  } else if (resultado === 'no_existe') {
    lines.push(`❓ No existe el comando «${cmdArgs[0]}» en esta máquina.`,
      'Qué hacer: revisa que esté bien escrito, o instálalo (npm install, apt-get install) y vuelve a intentar.');
  } else if (resultado === 'tiempo') {
    lines.push(`⏱️ Se detuvo por tiempo: ${cmdText} superó ${opts.limite} s y lo terminé, con todos sus procesos.`,
      'Causas habituales: un servidor que no termina, una descarga bloqueada o lenta, o una prueba que quedó esperando.',
      `Qué hacer: mira las últimas líneas; si solo era lento, repite con --limite mayor (y ajusta el timeout de la herramienta Bash).`);
  } else if (resultado === 'esperaba_respuesta') {
    lines.push(`⌨️ Se detuvo porque esperaba una respuesta del teclado: ${cmdText}`,
      'Qué hacer: repítelo con la opción que responde sola (por ejemplo --yes, -y o --ci).');
  } else if (resultado === 'interrumpido') {
    lines.push(`⏹️ Lo interrumpieron desde fuera: ${cmdText} (${secs(ms)}). Terminé también sus procesos.`,
      'Causa habitual: la herramienta que lo lanzó llegó a su propio límite de tiempo.',
      'Qué hacer: repítelo con un --limite menor que el timeout de la herramienta Bash, o sube ese timeout.');
  } else {
    lines.push(`❌ Falló (código ${exitCode}${signal ? `, señal ${signal}` : ''}): ${cmdText} (${secs(ms)})`);
  }
  if (resultado !== 'ok' && resultado !== 'no_existe' && cola.length) {
    lines.push(`--- últimas ${cola.length} líneas ---`, ...cola, '--- fin ---');
  }
  if (resultado !== 'ok') lines.push(`Registro completo: ${logRel}${logCut ? ' (recortado a 20 MB)' : ''}`);
  if (leftovers) lines.push('Nota: el comando terminó, pero dejó algún proceso en segundo plano con la salida abierta.');
  if (error && !notFound) lines.push(`Detalle técnico: ${error.message}`);

  const summary = lines.join('\n');
  log.end(`\n\n# resumen\n${summary}\n# fin: ${new Date().toISOString()} · código ${exitCode}\n`, () => {
    try {
      fs.appendFileSync(path.join(LOGS, 'ejecuciones.jsonl'), JSON.stringify({
        inicio: inicio.toISOString(), segundos: Math.round(ms / 1000), nombre, comando: cmdText,
        carpeta: path.relative(ROOT, process.cwd()) || '.', resultado, codigo: exitCode, registro: logRel,
      }) + '\n');
    } catch { /* sin carpeta de registros */ }
    console.log((opts.todo ? '\n' : '') + summary);
    process.exit(exitCode);
  });
}

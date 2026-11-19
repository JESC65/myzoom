#!/usr/bin/env node
// scripts/preflight.mjs · v1.0-myzoom · Verificación previa del entorno de MyZoom
// Adaptada de PromoConnect v1.2: sin Docker, PostgreSQL ni FFmpeg, que MyZoom no usa.
//
// Uso:   node scripts/preflight.mjs [--push] [--sin-red] [--solo-kit]
//   --push      instala la configuración del kit si falta y prueba escribir en GitHub:
//               guarda docs/PREFLIGHT.md con un commit y lo empuja
//   --sin-red   omite las pruebas de red
//   --solo-kit  revisa solo los archivos y la configuración del kit, y GitHub (unos segundos)
//
// Sin dependencias. Solo escribe docs/PREFLIGHT.md (y, con --push, hace un commit con ese archivo).
// Nunca termina en error: el veredicto va en pantalla y en docs/PREFLIGHT.md, en español sencillo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Raíz del repositorio: la carpeta que contiene scripts/, desde donde sea que se llame.
const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLAGS = new Set(process.argv.slice(2));
const PUSH = FLAGS.has('--push');
const SIN_RED = FLAGS.has('--sin-red');
const SOLO_KIT = FLAGS.has('--solo-kit');
const IS_WIN = process.platform === 'win32';
const EN_NUBE = process.env.CLAUDE_CODE_REMOTE === 'true';
const ES_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
const REPORT = path.join(ROOT, 'docs', 'PREFLIGHT.md');
const MARKER = path.join(ROOT, 'logs', '.gancho-inicio.json');

const results = [];
const tecnico = [];

// ---------- utilidades ----------
function run(cmd, args, { timeout = 20, input, env, shell = false } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT, encoding: 'utf8', timeout: timeout * 1000, shell, input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', CI: '1', DEBIAN_FRONTEND: 'noninteractive', npm_config_yes: 'true',
      npm_config_update_notifier: 'false', npm_config_fund: 'false', ...env },
  });
  const err = ((r.stderr || '') + (r.error ? ` ${r.error.message}` : '')).trim();
  return {
    ok: !r.error && r.status === 0, code: r.status, out: (r.stdout || '').trim(), err,
    timedOut: Boolean(r.error && r.error.code === 'ETIMEDOUT'),
    missing: Boolean(r.error && r.error.code === 'ENOENT'),
  };
}
const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
const npxCmd = IS_WIN ? 'npx.cmd' : 'npx';
const first = (t) => (t || '').split(/\r?\n/).find((l) => l.trim()) || '';
const last = (t, n = 6) => (t || '').split(/\r?\n/).filter((l) => l.trim()).slice(-n).join(' | ');
const lista = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`);
// De la salida de git, las líneas que explican el rechazo (GitHub las antepone con «remote:»).
const pickError = (t) => {
  const ls = (t || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const key = ls.filter((l) => /(GH0\d\d|denied|forbidden|403|rejected|protected|not allowed|permission|error)/i.test(l));
  return (key.length ? key : ls).slice(-2).join(' | ').slice(0, 300);
};
function add(grupo, nombre, estado, detalle, significa = '', accion = '') {
  results.push({ grupo, nombre, estado, detalle, significa, accion });
}
function safe(grupo, nombre, fn) {
  try { return fn(); } catch (e) {
    add(grupo, nombre, 'aviso', `la comprobación no pudo completarse (${e.message})`,
      'Es una falla de esta verificación, no necesariamente del entorno.',
      'Vuelve a ejecutar la verificación; si se repite, pide ayuda con el reporte.');
    return undefined;
  }
}
// Huella que no cambia por detalles de copia: el JSON se compara por contenido y el texto,
// sin BOM, con saltos de línea LF y sin espacios al final. Las imágenes, byte a byte.
// config-inicial/kit-manifest.json se generó con esta misma función.
export function normalizedSha(file) {
  const buf = fs.readFileSync(file);
  const name = path.basename(file);
  let data = buf;
  if (/\.json$/i.test(name)) {
    try { data = Buffer.from(JSON.stringify(JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, ''))), 'utf8'); } catch { /* JSON dañado: se compara tal cual */ }
  } else if (/\.(md|mjs|js|html|txt|yml|yaml)$/i.test(name) || name.startsWith('.')) {
    data = Buffer.from(buf.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\s+$/, '') + '\n', 'utf8');
  }
  return crypto.createHash('sha256').update(data).digest('hex');
}
function limaNow() {
  try {
    return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  } catch { return new Date().toISOString(); }
}

// ---------- 0. Configuración inicial ----------
// GitHub no siempre deja subir por la web archivos cuyo nombre empieza con punto. Por eso el kit
// trae la configuración en config-inicial/, y esta verificación la pone en su lugar (solo con --push,
// para que quede guardada en GitHub). Nunca reemplaza un archivo que ya existe.
const CONFIG = [
  { desde: 'config-inicial/claude-settings.json', hacia: '.claude/settings.json' },
  { desde: 'config-inicial/gitignore.txt', hacia: '.gitignore' },
  { desde: 'config-inicial/agents/Explore.md', hacia: '.claude/agents/Explore.md' },
  { desde: 'config-inicial/agents/auditor-independiente.md', hacia: '.claude/agents/auditor-independiente.md' },
];
const instalados = [];
function installConfig() {
  if (!PUSH) return;
  for (const c of CONFIG) {
    const src = path.join(ROOT, c.desde); const dst = path.join(ROOT, c.hacia);
    if (fs.existsSync(dst) || !fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    instalados.push(c.hacia);
  }
  if (instalados.length) {
    add('Archivos del kit', 'Configuración instalada ahora', 'aviso', lista(instalados) + ' (copiados desde config-inicial/)',
      'Quedan guardados en GitHub con esta verificación, pero Claude Code los lee al abrir una sesión: rigen desde la próxima.',
      'Abre una sesión nueva y repite esta verificación (Paso 6.3 de la guía).');
  }
}

// ---------- 1. Archivos del kit ----------
// Archivos que no deben estar en el repositorio (planes privados, guion, presentación).
// Para MyZoom: el plan de Gemini y la auditoría (decisiones ya resueltas en el encargo) y archivos de secretos.
const PRIVADOS = /(gemini|auditoria_|_privado|\.pptx$|(^|\/)\.env$|(^|\/)\.dev\.vars$)/i;

function listRepoFiles() {
  const r = run('git', ['ls-files', '--cached', '--others', '--exclude-standard']);
  if (r.ok && r.out) return r.out.split('\n');
  const out = [];
  const walk = (dir, depth) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (['.git', 'node_modules', 'logs'].includes(e.name)) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) { if (depth < 4) walk(rel, depth + 1); } else out.push(rel);
    }
  };
  walk('', 0);
  return out;
}

function checkKit() {
  const G = 'Archivos del kit';
  const manifestPath = path.join(ROOT, 'config-inicial', 'kit-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    add(G, 'Manifiesto del kit', 'falla', 'no existe config-inicial/kit-manifest.json',
      'Falta la lista que permite comprobar que el kit se subió completo.',
      'Vuelve a subir la carpeta config-inicial del kit (Paso 3 de la guía).');
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // Después de la Fase 0 el agente puede ajustar archivos del kit: una diferencia ya no es una falla.
  const empezado = fs.existsSync(path.join(ROOT, 'docs', 'ESTADO.md'));
  const faltan = []; const distintos = []; const opcionales = [];
  for (const f of manifest.archivos) {
    const candidatos = [f.ruta, ...(f.alternativas || [])].map((r) => path.join(ROOT, r));
    const encontrado = candidatos.find((c) => fs.existsSync(c));
    if (!encontrado) { (f.obligatorio ? faltan : opcionales).push(f.ruta); continue; }
    if (normalizedSha(encontrado) !== f.sha256) (f.obligatorio ? distintos : opcionales).push(f.ruta);
  }
  const total = manifest.archivos.filter((f) => f.obligatorio).length;
  if (faltan.length === 0 && distintos.length === 0) {
    add(G, 'Archivos del kit', 'ok', `${total} de ${total} archivos obligatorios presentes e intactos (kit ${manifest.version})`, 'El kit llegó completo a GitHub.', 'Nada.');
  } else {
    if (faltan.length) add(G, 'Archivos que faltan', 'falla', faltan.join(', '),
      'Esos archivos no llegaron al repositorio.', 'Súbelos de nuevo desde el kit, en la misma carpeta (Paso 3 de la guía).');
    if (distintos.length && !empezado) add(G, 'Archivos distintos de los del kit', 'falla', distintos.join(', '),
      'El archivo está, pero su contenido no es el del kit: la subida quedó incompleta o se editó.',
      'Bórralo en GitHub y súbelo otra vez desde el kit.');
    if (distintos.length && empezado) add(G, 'Archivos ajustados después de instalar el kit', 'aviso', distintos.join(', '),
      'El trabajo ya empezó y el agente puede haberlos ajustado.', 'Nada, si docs/DECISIONES.md o la bitácora lo explican.');
  }
  if (opcionales.length) add(G, 'Archivos opcionales distintos', 'aviso', opcionales.join(', '),
    'No impiden empezar (por ejemplo, un README creado por GitHub).', 'Nada.');
  let files = [];
  try { files = listRepoFiles(); } catch { /* sin lista: se omiten las dos comprobaciones siguientes */ }
  const conocidos = new Set(manifest.archivos.flatMap((f) => [f.ruta, ...(f.alternativas || [])]));
  const otrosEncargos = files.filter((f) => /encargo/i.test(path.basename(f)) && f.endsWith('.md') && !conocidos.has(f));
  if (otrosEncargos.length) add(G, 'Otro encargo en el repositorio', 'aviso', otrosEncargos.join(', '),
    'Puede ser una versión anterior: dos encargos distintos confunden al agente.', 'Bórralo en GitHub, salvo que sea una versión nueva a propósito.');
  const privados = files.filter((f) => PRIVADOS.test(f) && !f.endsWith('.example'));
  if (privados.length) add(G, 'Archivos privados en el repositorio', 'aviso', privados.join(', '),
    'El encargo pide no subir el plan de Gemini, la auditoría ni archivos de claves.', 'Bórralos en GitHub (el agente no los necesita).');
  tecnico.push(`kit: versión ${manifest.version}, ${manifest.archivos.length} archivos en el manifiesto${empezado ? ', trabajo ya empezado' : ''}`);
}

function checkSettings() {
  const G = 'Archivos del kit';
  const p = path.join(ROOT, '.claude', 'settings.json');
  if (!fs.existsSync(p)) {
    const alt = fs.existsSync(path.join(ROOT, 'config-inicial', 'claude-settings.json'));
    add(G, 'Configuración .claude/settings.json', 'falla',
      alt ? 'todavía no está instalada (solo está config-inicial/claude-settings.json)' : 'no existe, ni en config-inicial/',
      'Sin este archivo, Claude Code no tiene los permisos ni el gancho de reanudación.',
      alt ? 'Ejecuta: node scripts/preflight.mjs --push (la instala y la guarda en GitHub).'
        : 'Sube otra vez la carpeta config-inicial del kit (Paso 3 de la guía).');
    return;
  }
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
    add(G, 'Configuración .claude/settings.json', 'falla', `no es JSON válido (${e.message})`,
      'El archivo se dañó al copiarlo: le sobra o le falta un carácter.', 'Reemplázalo por el del kit, sin editarlo.');
    return;
  }
  const allow = cfg?.permissions?.allow?.length || 0;
  const hook = JSON.stringify(cfg?.hooks?.SessionStart || '');
  const ok = allow >= 20 && hook.includes('session-start.mjs');
  if (!fs.existsSync(path.join(ROOT, '.gitignore'))) {
    add(G, 'Lista de archivos ignorados (.gitignore)', 'falla', 'no existe',
      'Sin ella, los registros locales y los secretos de desarrollo podrían terminar en GitHub.',
      'Ejecuta: node scripts/preflight.mjs --push (la instala desde config-inicial/gitignore.txt).');
  }
  add(G, 'Configuración .claude/settings.json', ok ? 'ok' : 'aviso',
    `${allow} permisos, gancho de inicio ${hook.includes('session-start.mjs') ? 'presente' : 'ausente'}, modo ${cfg?.permissions?.defaultMode || '(sin definir)'}`,
    ok ? 'Permisos y gancho en su lugar.' : 'La configuración está incompleta.',
    ok ? 'Nada.' : 'Reemplázala por la del kit.');
}

// Subagentes del kit: Explore para buscar (Haiku) y auditor-independiente para la revisión de la sección 14.3 del encargo (Opus).
const AGENTES = [
  { archivo: 'Explore.md', nombre: 'Explore', modelo: 'haiku' },
  { archivo: 'auditor-independiente.md', nombre: 'auditor-independiente', modelo: 'opus' },
];
// Lee name y model del encabezado YAML de un subagente.
export function agentInfo(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text || '');
  if (!m) return null;
  const get = (k) => ((new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(m[1]) || [])[1] || '').trim();
  return { name: get('name'), model: get('model') };
}
function checkAgents() {
  const G = 'Archivos del kit';
  const faltan = []; const distintos = [];
  for (const a of AGENTES) {
    const p = path.join(ROOT, '.claude', 'agents', a.archivo);
    if (!fs.existsSync(p)) { faltan.push(a.archivo); continue; }
    const info = agentInfo(fs.readFileSync(p, 'utf8'));
    if (!info || info.name !== a.nombre || info.model !== a.modelo) {
      distintos.push(`${a.archivo} (${info ? `name: ${info.name || '—'}, model: ${info.model || '—'}` : 'sin encabezado'})`);
    }
  }
  if (faltan.length) {
    const alt = fs.existsSync(path.join(ROOT, 'config-inicial', 'agents'));
    add(G, 'Subagentes del kit', 'falla', `faltan en .claude/agents/: ${lista(faltan)}`,
      'Sin ellos, las búsquedas usan el modelo de la sesión y la revisión independiente no tiene su auditor en Opus.',
      alt ? 'Ejecuta: node scripts/preflight.mjs --push (los instala desde config-inicial/agents/).'
        : 'Sube otra vez la carpeta config-inicial del kit (Paso 3 de la guía).');
  } else if (distintos.length) {
    add(G, 'Subagentes del kit', 'aviso', `con otro nombre o modelo: ${distintos.join('; ')}`,
      'Puede ser un ajuste a propósito; si no, la búsqueda o la auditoría correrían en otro modelo.',
      'Compáralos con config-inicial/agents/ y registra el cambio en docs/DECISIONES.md si fue a propósito.');
  } else {
    add(G, 'Subagentes del kit', 'ok', 'Explore (haiku) y auditor-independiente (opus) en .claude/agents/',
      'Búsquedas económicas y auditoría independiente en Opus, sea cual sea el modelo de la sesión.', 'Nada.');
  }
}

// ---------- 2. Sesión de Claude Code ----------
function checkSession() {
  const G = 'Sesión de Claude Code';
  add(G, 'Dónde corre', EN_NUBE ? 'ok' : 'aviso',
    EN_NUBE ? 'sesión de Claude Code en la nube' : 'no es una sesión en la nube (equipo local u otra herramienta)',
    EN_NUBE ? 'Es el mismo tipo de lugar donde trabajarán los tramos.' : 'Las pruebas valen, pero la definitiva es en la nube con el entorno del proyecto.',
    EN_NUBE ? 'Nada.' : 'Repite esta verificación en una sesión de claude.ai/code (Paso 6 de la guía).');
  if (process.env.CLAUDE_CODE_REMOTE_SESSION_ID) {
    tecnico.push('sesión: https://claude.ai/code/' + process.env.CLAUDE_CODE_REMOTE_SESSION_ID.replace(/^cse_/, 'session_'));
  }
  let marca = null;
  try { marca = JSON.parse(fs.readFileSync(MARKER, 'utf8')); } catch { /* sin marca */ }
  const reciente = marca && (Date.now() - Date.parse(marca.fecha)) < 12 * 3600 * 1000;
  add(G, 'Gancho de inicio (reanudación)', reciente ? 'ok' : 'aviso',
    reciente ? `corrió al abrir esta sesión (${marca.fecha})` : 'no detecté que haya corrido en esta máquina',
    reciente ? 'Cada sesión nueva verá dónde quedó el trabajo.' : 'Si no corre, el agente igual puede retomar, pero leyendo el estado a mano.',
    reciente ? 'Nada.' : instalados.includes('.claude/settings.json')
      ? 'Es normal: la configuración se instaló en esta misma verificación. Abre una sesión nueva y repítela.'
      : 'Abre la sesión normal de claude.ai/code (no dentro de un «Proyecto» de Claude Code) y verifica que .claude/settings.json esté en la raíz.');
  const vars = ['BASH_DEFAULT_TIMEOUT_MS', 'BASH_MAX_TIMEOUT_MS'];
  const faltan = vars.filter((v) => !process.env[v]);
  add(G, 'Variables de entorno', faltan.length ? 'aviso' : 'ok',
    faltan.length ? `faltan: ${faltan.join(', ')}` : vars.map((v) => `${v}=${process.env[v]}`).join(' · '),
    faltan.length ? 'Sin ellas, los comandos largos pasan a segundo plano antes de terminar.' : 'Los comandos largos tienen tiempo suficiente.',
    faltan.length ? 'Agrégalas en el entorno (Paso 5 de la guía) y abre una sesión nueva.' : 'Nada.');
  // Variables que anulan el plan de modelos y de esfuerzo por tramo.
  const sobran = ['CLAUDE_CODE_SUBAGENT_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL_FORCE', 'CLAUDE_CODE_EFFORT_LEVEL'].filter((v) => process.env[v]);
  if (sobran.length) {
    add(G, 'Variables que conviene quitar', 'aviso', sobran.map((v) => `${v}=${process.env[v]}`).join(' · '),
      'CLAUDE_CODE_SUBAGENT_MODEL pone a los subagentes generales en ese modelo aunque la sesión use otro (con _FORCE, a todos); CLAUDE_CODE_EFFORT_LEVEL fija un mismo esfuerzo para todas las sesiones.',
      'Quítalas de «Environment variables» del entorno (Paso 5 de la guía) y abre una sesión nueva: el esfuerzo se elige en cada sesión con /effort.');
  }
  // MyZoom: las claves de Cloudflare viven solo en Cloudflare, nunca en el entorno de la sesión.
  const claves = cloudflareSecretsIn(process.env);
  if (claves.length) {
    add(G, 'Claves de Cloudflare en el entorno', 'aviso', `definidas: ${claves.join(', ')} (no muestro sus valores)`,
      'El encargo no las necesita: el agente construye y prueba en modo ensayo. Una clave en el entorno la puede leer cualquier comando de la sesión.',
      'Quítalas de «Environment variables» del entorno y ponlas solo en Cloudflare (guía, Paso 9).');
  }
}

// Nombres de variables con claves de Cloudflare o de MyZoom que no deben estar en el entorno.
export function cloudflareSecretsIn(env) {
  const nombres = ['CF_API_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'HOST_SECRET', 'INVITE_CODE'];
  return nombres.filter((n) => typeof env[n] === 'string' && env[n].trim() !== '');
}

// ---------- 3. Herramientas ----------
function checkNode() {
  const G = 'Herramientas';
  const major = Number(process.versions.node.split('.')[0]);
  add(G, 'Node.js', major >= 20 ? 'ok' : major >= 18 ? 'aviso' : 'falla', `v${process.versions.node}`,
    major >= 20 ? 'Versión suficiente para Vite y Wrangler.' : 'Versión antigua para Vite y Wrangler.',
    major >= 20 ? 'Nada.' : 'Instala la LTS de nodejs.org.');
  const n = run(npmCmd, ['-v'], { shell: IS_WIN });
  add(G, 'npm', n.ok ? 'ok' : 'falla', n.ok ? `v${n.out}` : first(n.err) || 'no responde',
    n.ok ? 'Instalador de paquetes disponible.' : 'Sin npm no se puede instalar nada.', n.ok ? 'Nada.' : 'Reinstala Node.js.');
  const g = run('git', ['--version']);
  add(G, 'Git', g.ok ? 'ok' : 'falla', g.ok ? g.out : 'no responde',
    g.ok ? 'Control de versiones disponible.' : 'Sin Git no se guarda nada en GitHub.', g.ok ? 'Nada.' : 'Instala Git.');
  tecnico.push(`node v${process.versions.node} · npm ${n.out || '?'} · ${g.out || 'git ?'} · ${os.platform()} ${os.release()} ${os.arch()}`);
}

// Chromium para Playwright: en la nube suele venir instalado. Si no, se descarga en la Fase 2.
export function findChromium(env = process.env, home = os.homedir(), fijas = ['/opt/pw-browsers']) {
  const dirs = [env.PLAYWRIGHT_BROWSERS_PATH, ...fijas, path.join(home, '.cache', 'ms-playwright'),
    path.join(home, 'AppData', 'Local', 'ms-playwright')].filter(Boolean);
  for (const d of dirs) {
    try {
      const hit = fs.readdirSync(d).find((n) => /^chromium/i.test(n));
      if (hit) return path.join(d, hit);
    } catch { /* no existe */ }
  }
  return null;
}
function checkChromium() {
  const hit = findChromium();
  add('Herramientas', 'Navegador para pruebas de pantalla', hit ? 'ok' : 'aviso', hit ? `Chromium en ${hit}` : 'no encontré un Chromium instalado para Playwright',
    hit ? 'Las pruebas de pantalla (Fase 2) pueden correr sin descargar nada.' : 'El agente lo descargará en la Fase 2; necesita cdn.playwright.dev en la red.',
    hit ? 'Nada.' : 'Nada ahora. Si la descarga falla, agrega cdn.playwright.dev a «Allowed domains» (Paso 5 de la guía).');
}

// ---------- 4. Red ----------
const DESTINOS = [
  { host: 'registry.npmjs.org', url: 'https://registry.npmjs.org/-/ping', para: 'paquetes de npm (SDK de RealtimeKit, React, Vite, Wrangler)', critico: true, defecto: true },
  { host: 'nodejs.org', url: 'https://nodejs.org/dist/index.json', para: 'versiones de Node.js', critico: false, defecto: true },
  { host: 'developers.cloudflare.com', url: 'https://developers.cloudflare.com/realtime/realtimekit/', para: 'leer la documentación oficial de RealtimeKit y Workers', critico: false },
  { host: 'cdn.playwright.dev', url: 'https://cdn.playwright.dev/', para: 'descargar el navegador de pruebas, si no viene instalado', critico: false, soloSinNavegador: true },
  { host: 'playwright.download.prss.microsoft.com', url: 'https://playwright.download.prss.microsoft.com/', para: 'el navegador de pruebas (alterno)', critico: false, soloSinNavegador: true },
]

function probe(url) {
  const r = run('curl', ['-sS', '-v', '-o', os.devNull, '--max-time', '15', '-w', '%{http_code} %{http_connect}', url], { timeout: 25 });
  if (r.missing) return { estado: 'aviso', detalle: 'curl no está instalado: no pude probar' };
  const [http = '000', connect = '000'] = (r.out || '').split(' ');
  if (/x-deny-reason|host_not_allowed/i.test(r.err) || connect === '403' || connect === '407' || /CONNECT tunnel failed, response 40[37]/i.test(r.err)) {
    return { estado: 'falla', tipo: 'bloqueado', detalle: `bloqueado por la lista de red del entorno (respuesta ${connect !== '000' ? connect : '403'})` };
  }
  if (r.code === 0 && Number(http) >= 100) return { estado: 'ok', detalle: `responde (HTTP ${http})` };
  if (r.code === 6) return { estado: 'falla', tipo: 'dns', detalle: 'no se encontró el nombre del servidor (DNS)' };
  if (r.code === 28) return { estado: 'aviso', tipo: 'lento', detalle: 'no respondió en 15 segundos' };
  return { estado: 'falla', tipo: 'otro', detalle: `no se pudo conectar (curl ${r.code}): ${last(r.err, 1)}` };
}

const probes = new Map();
function probeCached(url) {
  if (!probes.has(url)) probes.set(url, probe(url));
  return probes.get(url);
}

function checkNetwork() {
  const G = 'Red';
  const navegador = findChromium();
  for (const d of DESTINOS) {
    if (d.soloSinNavegador && navegador) {
      add(G, d.host, 'omitido', 'no hace falta: Chromium ya está instalado en esta máquina', '', '');
      continue;
    }
    const p = probeCached(d.url);
    const estado = p.estado === 'falla' && !d.critico ? 'aviso' : p.estado;
    const bloqueado = p.tipo === 'bloqueado';
    add(G, d.host, estado, p.detalle,
      estado === 'ok' ? `Se puede descargar ${d.para}.` : `No se puede llegar a ${d.host}, que sirve para ${d.para}.`,
      estado === 'ok' ? 'Nada.' : bloqueado
        ? (d.defecto
          ? 'Viene en la lista por defecto: en la red del entorno marca «Also include default list of common package managers» (Paso 5 de la guía), guarda y repite esta verificación en un minuto.'
          : `Agrega ${d.host} a «Allowed domains» del entorno (Paso 5 de la guía), guarda y repite esta verificación en un minuto.`)
        : p.tipo === 'dns'
          ? 'Revisa que «Network access» del entorno no esté en «None» (Paso 5 de la guía); si no, vuelve a probar en unos minutos.'
          : 'Vuelve a probar en unos minutos; si persiste, pide ayuda con el reporte.');
  }
  const v = run(npmCmd, ['view', '@cloudflare/realtimekit-react-ui', 'version'], { timeout: 90, shell: IS_WIN });
  add(G, 'npm consulta el registro', v.ok ? 'ok' : 'falla', v.ok ? `@cloudflare/realtimekit-react-ui ${v.out} disponible` : `falló: ${last(v.err, 2)}`,
    v.ok ? 'npm instala paquetes a través de la red del entorno.' : 'npm no puede descargar paquetes: no se podrá construir nada.',
    v.ok ? 'Nada.' : 'Revisa que la red sea Custom con la lista por defecto incluida (Paso 5 de la guía).');
}

// ---------- 5. GitHub ----------
function checkGit() {
  const G = 'GitHub';
  if (run('git', ['rev-parse', '--is-inside-work-tree']).out !== 'true') {
    add(G, 'Repositorio', 'falla', 'esta carpeta no es un repositorio Git', 'No hay dónde guardar el trabajo.',
      'Abre la sesión sobre el repositorio del proyecto (Paso 6 de la guía).');
    return null;
  }
  const rama = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out || '(desconocida)';
  const remoto = (run('git', ['remote', 'get-url', 'origin']).out || '(sin remoto)').replace(/\/\/[^@/]+@/, '//***@');
  tecnico.push(`rama ${rama} · remoto ${remoto} · commit ${run('git', ['rev-parse', '--short', 'HEAD']).out || '?'} · copia superficial: ${run('git', ['rev-parse', '--is-shallow-repository']).out === 'true' ? 'sí' : 'no'}`);
  const ls = run('git', ['ls-remote', '--heads', 'origin'], { timeout: 40 });
  if (!ls.ok) {
    add(G, 'Lectura desde GitHub', 'falla', `no pude leer el repositorio remoto: ${pickError(ls.err)}`,
      'La sesión no tiene acceso al repositorio en GitHub.', 'Instala o configura la Claude GitHub App para este repositorio (Paso 4 de la guía).');
    return { rama };
  }
  const ramas = ls.out ? ls.out.split('\n').map((l) => l.split('\t')) : [];
  const pendientes = ramas.filter(([sha]) => {
    const conocida = run('git', ['cat-file', '-e', `${sha}^{commit}`]).ok;
    return !(conocida && run('git', ['merge-base', '--is-ancestor', sha, 'HEAD']).ok);
  }).map(([, ref]) => ref.replace('refs/heads/', ''));
  add(G, 'Lectura desde GitHub', 'ok', `${ramas.length} rama(s) en GitHub; estás en «${rama}»`, 'La sesión ve el repositorio.', 'Nada.');
  if (pendientes.length) add(G, 'Trabajo en otras ramas', 'aviso', pendientes.join(', '),
    'Hay ramas con commits que esta copia no tiene.', 'Si es trabajo de una sesión anterior, el agente lo integrará al retomar (sección 11.3).');
  return { rama };
}

function gitIdentity() {
  const name = run('git', ['config', 'user.name']).out;
  const mail = run('git', ['config', 'user.email']).out;
  return name && mail ? [] : ['-c', 'user.name=Verificacion previa', '-c', 'user.email=preflight@localhost'];
}

function pushTest(info) {
  const G = 'GitHub';
  if (!PUSH || !info) {
    if (!PUSH) add(G, 'Escritura en GitHub', 'omitido', 'no se pidió --push', 'No probé si la sesión puede guardar en GitHub.',
      'Ejecuta: node scripts/preflight.mjs --push');
    return;
  }
  const id = gitIdentity();
  const paths = ['docs/PREFLIGHT.md', ...instalados];
  run('git', ['add', '--', ...paths]);
  const msg = instalados.length ? 'Verificación previa del entorno e instalación de la configuración inicial' : 'Verificación previa del entorno';
  const c = run('git', [...id, 'commit', '-m', msg, '--', ...paths], { timeout: 30 });
  if (!c.ok && !/nothing to commit|nada para hacer commit/i.test(c.out + c.err)) {
    add(G, 'Escritura en GitHub', 'falla', `no pude hacer el commit: ${last(c.err || c.out, 2)}`, 'Git local no pudo guardar el cambio.', 'Pide ayuda con el reporte.');
    return;
  }
  const p1 = run('git', ['push', '-u', 'origin', 'HEAD'], { timeout: 90 });
  add(G, `Guardar en la rama «${info.rama}»`, p1.ok ? 'ok' : 'falla',
    p1.ok ? 'empujé el informe a GitHub' : `rechazado: ${pickError(p1.err)}`,
    p1.ok ? 'La sesión puede guardar su trabajo en GitHub.' : 'La sesión no puede guardar en GitHub: el trabajo se perdería.',
    p1.ok ? 'Nada.' : 'Revisa que la Claude GitHub App tenga acceso a este repositorio (Paso 4 de la guía).');
  if (info.rama !== 'main') {
    const p2 = run('git', ['push', 'origin', 'HEAD:main'], { timeout: 90 });
    add(G, 'Guardar en la rama main', p2.ok ? 'ok' : 'aviso',
      p2.ok ? 'también pude empujar a main' : `main rechazó el envío: ${pickError(p2.err)}`,
      p2.ok ? 'El agente podrá integrar cada tarea en main, como pide el encargo.' : 'El agente guardará en su rama de sesión y la integrará después (sección 10.2).',
      p2.ok ? 'Nada.' : 'No bloquea. Si quieres que use main, revisa que main no tenga reglas de protección en GitHub.');
  }
}

// ---------- 6. Sistema ----------
function checkSystem() {
  const G = 'Sistema';
  try {
    const s = fs.statfsSync(ROOT);
    const libres = (s.bavail * s.bsize) / 1024 ** 3;
    add(G, 'Espacio en disco', libres >= 3 ? 'ok' : libres >= 1 ? 'aviso' : 'falla', `${libres.toFixed(1)} GB libres`,
      libres >= 3 ? 'Suficiente para dependencias y pruebas.' : 'Poco espacio para dependencias y el navegador de pruebas.',
      libres >= 3 ? 'Nada.' : 'Libera espacio o pide ayuda con el reporte.');
  } catch { add(G, 'Espacio en disco', 'omitido', 'esta versión de Node no permite medirlo', '', ''); }
  const ram = os.totalmem() / 1024 ** 3;
  add(G, 'Memoria', ram >= 4 ? 'ok' : 'aviso', `${ram.toFixed(1)} GB, ${os.cpus().length} procesadores`,
    ram >= 4 ? 'Suficiente.' : 'Poca memoria para compilar y probar.', ram >= 4 ? 'Nada.' : 'No bloquea.');
  let mes = '';
  try { mes = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'full', timeStyle: 'short' }).format(new Date('2026-11-22T00:00:00Z')); } catch { /* sin ICU */ }
  const icuOk = /s[áa]bado.*21.*noviembre/i.test(mes) && /7:00/.test(mes);
  add(G, 'Hora de Lima y español', icuOk ? 'ok' : 'aviso', mes ? `22-nov-2026 00:00 UTC → «${mes}»` : 'sin datos de zona horaria',
    icuOk ? 'Fechas y plazos en hora de Lima, en español.' : 'Node no convierte bien la hora de Lima o el español.',
    icuOk ? 'Nada.' : 'Pide ayuda con el reporte.');
  try {
    const f = path.join(ROOT, `.preflight-${process.pid}.tmp`);
    fs.writeFileSync(f, 'ok'); fs.rmSync(f);
    const t = path.join(os.tmpdir(), `preflight-${process.pid}.tmp`);
    fs.writeFileSync(t, 'ok'); fs.rmSync(t);
    add(G, 'Permiso para crear archivos', 'ok', 'en el repositorio y en la carpeta temporal', 'El agente puede escribir su trabajo.', 'Nada.');
  } catch (e) {
    add(G, 'Permiso para crear archivos', 'falla', e.message, 'El agente no podría guardar nada.', 'Pide ayuda con el reporte.');
  }
}

// ---------- informe ----------
const ICON = { ok: '✅', aviso: '⚠️', falla: '❌', omitido: '➖' };
const ORDEN = ['Archivos del kit', 'Sesión de Claude Code', 'Herramientas', 'Red', 'GitHub', 'Sistema'];
const ordenados = () => results.map((r, i) => ({ r, i }))
  .sort((a, b) => (ORDEN.indexOf(a.r.grupo) - ORDEN.indexOf(b.r.grupo)) || (a.i - b.i)).map((x) => x.r);
function verdict() {
  const solo = SOLO_KIT ? ' Esta pasada revisó solo el kit y GitHub; la verificación completa es sin --solo-kit.' : '';
  if (results.some((r) => r.estado === 'falla')) return { icono: '❌', texto: 'NO LISTO', frase: 'Corrige lo marcado con ❌ (columna «Qué hacer») y vuelve a ejecutar esta verificación.' + solo };
  if (results.some((r) => r.estado === 'aviso')) return { icono: '⚠️', texto: 'LISTO, CON AVISOS', frase: 'Puedes empezar: los avisos no bloquean, pero lee qué conviene hacer con cada uno.' + solo };
  return { icono: '✅', texto: 'LISTO PARA EMPEZAR', frase: (SOLO_KIT ? 'El kit está completo.' : 'Todo lo necesario funciona. Siguiente paso: lanzar el tramo 1 con Opus (Paso 7 de la guía).') + solo };
}
const cell = (t) => String(t || '').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
function writeReport(pushNote = '') {
  const v = verdict();
  const rama = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out || '?';
  const commit = run('git', ['rev-parse', '--short', 'HEAD']).out || '?';
  const lines = [
    '# Verificación previa del entorno · MyZoom',
    `_Fecha: ${limaNow()} (hora de Lima) · Entorno: ${EN_NUBE ? 'nube de Claude Code' : 'equipo local'} · Rama: ${rama} · Commit: ${commit}_`,
    '',
    `## Veredicto: ${v.icono} ${v.texto}`,
    '',
    v.frase,
    pushNote,
    '',
    '## Qué revisé',
    '',
    '| | Comprobación | Resultado | Qué significa | Qué hacer |',
    '|---|---|---|---|---|',
    ...ordenados().map((r) => `| ${ICON[r.estado]} | ${cell(r.grupo)} · ${cell(r.nombre)} | ${cell(r.detalle)} | ${cell(r.significa)} | ${cell(r.accion)} |`),
    '',
    '## Datos técnicos (para quien te ayude)',
    '',
    '```text',
    ...tecnico,
    `opciones: ${[...FLAGS].join(' ') || '(ninguna)'}`,
    '```',
    '',
    '## Si necesitas ayuda',
    '',
    'Copia este archivo completo, pégalo en tu conversación con Claude y escribe: «Explícame este resultado y dime qué hago».',
    '',
  ];
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, lines.join('\n'));
  return v;
}

async function main() {
  console.log('Verificación previa del entorno · ' + limaNow());
  console.log(SOLO_KIT ? 'Solo los archivos del kit y GitHub: unos segundos.\n'
    : 'Esto tarda alrededor de un minuto. No necesita Docker, PostgreSQL ni FFmpeg.\n');
  safe('Archivos del kit', 'Configuración inicial', installConfig);
  safe('Archivos del kit', 'Kit', checkKit);
  safe('Archivos del kit', 'Configuración', checkSettings);
  safe('Archivos del kit', 'Subagentes', checkAgents);
  if (!SOLO_KIT) {
    safe('Sesión de Claude Code', 'Sesión', checkSession);
    safe('Herramientas', 'Node', checkNode);
    safe('Herramientas', 'Navegador', checkChromium);
    if (SIN_RED) add('Red', 'Pruebas de red', 'omitido', 'se pidió --sin-red', '', '');
    else safe('Red', 'Red', checkNetwork);
  }
  const info = safe('GitHub', 'Git', checkGit);
  if (!SOLO_KIT) safe('Sistema', 'Sistema', checkSystem);
  writeReport();
  if (PUSH) {
    safe('GitHub', 'Escritura', () => pushTest(info));
    writeReport();
    if (PUSH && info) {
      run('git', [...gitIdentity(), 'commit', '-m', 'Verificación previa: resultado final', '--', 'docs/PREFLIGHT.md'], { timeout: 30 });
      run('git', ['push', 'origin', 'HEAD'], { timeout: 90 });
      if (info.rama !== 'main') run('git', ['push', 'origin', 'HEAD:main'], { timeout: 90 });
    }
  } else {
    pushTest(null);
    writeReport();
  }
  const v = verdict();
  let grupo = '';
  for (const r of ordenados()) {
    if (r.grupo !== grupo) { grupo = r.grupo; console.log(`\n${grupo}`); }
    console.log(`  ${ICON[r.estado]} ${r.nombre}: ${r.detalle}`);
    if (r.estado === 'falla' || r.estado === 'aviso') console.log(`     → ${r.accion}`);
  }
  console.log(`\nVEREDICTO: ${v.icono} ${v.texto}\n${v.frase}`);
  console.log(`Informe completo: docs/PREFLIGHT.md${PUSH ? ' (también en GitHub)' : ''}`);
}

// Solo se ejecuta si se llama directamente (el generador del manifiesto importa normalizedSha).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.log('La verificación previa tuvo un error interno: ' + (e && e.stack || e));
    console.log('Copia este mensaje y pide ayuda; no es necesariamente un problema del entorno.');
  }).finally(() => process.exit(0));
}

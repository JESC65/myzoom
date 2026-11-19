// tests/kit/herramientas.test.mjs · pruebas de las herramientas del kit (scripts/*.mjs)
// Ejecutar con:  node --test tests/kit/
// No usan red, Docker ni PostgreSQL. Cada prueba trabaja en una carpeta temporal propia.
// Kit de MyZoom v1.0, adaptado del kit de PromoConnect v1.2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN = path.join(REPO, 'scripts', 'run.mjs');
const NODE = process.execPath;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kit-test-'));
const runWrapper = (dir, args) => spawnSync(NODE, [RUN, ...args], {
  cwd: dir, encoding: 'utf8', timeout: 60000, env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
});
// Vivo de verdad: existe y, en Linux, no es un «zombi» (terminado, a la espera de que lo recojan).
const alive = (pid) => {
  try { process.kill(pid, 0); } catch { return false; }
  try { const st = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); return st.slice(st.lastIndexOf(')') + 2, st.lastIndexOf(')') + 3) !== 'Z'; }
  catch { return true; }
};

test('run.mjs: un comando que termina bien devuelve 0 y deja su registro', () => {
  const dir = tmp();
  const r = runWrapper(dir, ['--', NODE, '-e', "console.log('hola')"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /✅ Terminó bien/);
  const logs = fs.readdirSync(path.join(dir, 'logs')).filter((f) => f.endsWith('.log'));
  assert.equal(logs.length, 1);
  assert.match(fs.readFileSync(path.join(dir, 'logs', logs[0]), 'utf8'), /hola/);
  const rec = JSON.parse(fs.readFileSync(path.join(dir, 'logs', 'ejecuciones.jsonl'), 'utf8').trim());
  assert.equal(rec.resultado, 'ok');
});

test('run.mjs: una falla devuelve el código del comando y muestra las últimas líneas', () => {
  const dir = tmp();
  const r = runWrapper(dir, ['--cola', '3', '--', NODE, '-e', "for (let i = 1; i <= 9; i++) console.log('linea ' + i); process.exit(3)"]);
  assert.equal(r.status, 3);
  assert.match(r.stdout, /❌ Falló \(código 3\)/);
  assert.match(r.stdout, /linea 9/);
  assert.doesNotMatch(r.stdout, /linea 5/);
});

test('run.mjs: al vencer el límite termina el comando y también sus procesos hijos', () => {
  const dir = tmp();
  const script = "const c = require('child_process').spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 120000)'], { stdio: 'ignore' });"
    + " console.log('NIETO=' + c.pid); setTimeout(() => {}, 120000);";
  const t0 = Date.now();
  const r = runWrapper(dir, ['--limite', '2', '--', NODE, '-e', script]);
  assert.equal(r.status, 124);
  assert.match(r.stdout, /⏱️ Se detuvo por tiempo/);
  assert.ok(Date.now() - t0 < 20000, 'tardó demasiado en detenerse');
  const nieto = Number((r.stdout.match(/NIETO=(\d+)/) || [])[1]);
  assert.ok(nieto > 0, 'no se vio el proceso nieto');
  assert.equal(alive(nieto), false, 'el proceso nieto quedó vivo');
});

test('run.mjs: un comando inexistente devuelve 127 con un mensaje claro', () => {
  const dir = tmp();
  const r = runWrapper(dir, ['--', 'comando-que-no-existe-' + process.pid]);
  assert.equal(r.status, 127);
  assert.match(r.stdout, /No existe el comando/);
});

test('run.mjs: la entrada del teclado está cerrada, nada se queda esperando', () => {
  const dir = tmp();
  const r = runWrapper(dir, ['--limite', '20', '--', NODE, '-e',
    "process.stdin.on('data', () => {}); process.stdin.on('end', () => console.log('FIN_ENTRADA'));"]);
  assert.equal(r.status, 0);
  assert.match(fs.readFileSync(path.join(dir, 'logs', fs.readdirSync(path.join(dir, 'logs')).find((f) => f.endsWith('.log'))), 'utf8'), /FIN_ENTRADA/);
});

test('ayuda.mjs: quita tokens, claves y contraseñas', async () => {
  const { redact } = await import(pathToFileURL(path.join(REPO, 'scripts', 'ayuda.mjs')).href);
  const secretos = [
    'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
    'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz',
    'sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345',
    'AKIAABCDEFGHIJKLMNOP',
    'SuperSecreta123',
    'hunter22',
    'Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MA==',
    'cfAbCdEfGhIjKlMnOpQrStUvWxYz0123456789ab',
    'ClaveDelSalon2026',
    'PROMO81-SAB',
  ];
  const texto = [
    `token ${secretos[0]}`, `otro ${secretos[1]}`, `ANTHROPIC_API_KEY=${secretos[2]}`, `aws ${secretos[3]}`,
    `URL=https://app:${secretos[4]}@example.com/x`, `password: ${secretos[5]}`,
    `ALGUNA_KEK=${secretos[6]}`,
    `Authorization: Bearer ${secretos[7]}`, `HOST_SECRET=${secretos[8]}`, `INVITE_CODE=${secretos[9]}`,
    '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE\n-----END OPENSSH PRIVATE KEY-----',
    'Error: falló la prueba de la ventana horaria',
  ].join('\n');
  const limpio = redact(texto);
  for (const s of secretos) assert.ok(!limpio.includes(s), `quedó un secreto: ${s.slice(0, 8)}…`);
  assert.ok(!limpio.includes('b3BlbnNzaC1rZXktdjE'));
  assert.match(limpio, /falló la prueba de la ventana horaria/);
});

test('session-start.mjs: en una carpeta sin estado anuncia la primera sesión y termina en 0', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(path.join(REPO, 'scripts', 'session-start.mjs'), path.join(dir, 'scripts', 'session-start.mjs'));
  const env = { ...process.env }; delete env.CLAUDE_PROJECT_DIR;
  const r = spawnSync(NODE, [path.join(dir, 'scripts', 'session-start.mjs')], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 30000, env });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /PRIMERA SESIÓN/);
  assert.ok(fs.existsSync(path.join(dir, 'logs', '.gancho-inicio.json')), 'no dejó la marca del gancho');
});

test('preflight.mjs: la huella no cambia por saltos de línea de Windows ni por el formato del JSON', async () => {
  const { normalizedSha } = await import(pathToFileURL(path.join(REPO, 'scripts', 'preflight.mjs')).href);
  const dir = tmp();
  const w = (n, t) => { fs.writeFileSync(path.join(dir, n), t); return path.join(dir, n); };
  assert.equal(normalizedSha(w('a.md', 'uno\ndos\n')), normalizedSha(w('b.md', 'uno\r\ndos\r\n\r\n')));
  assert.equal(normalizedSha(w('a.json', '{"x": [1, 2]}\n')), normalizedSha(w('b.json', '{\r\n  "x": [1,2]\r\n}')));
  assert.notEqual(normalizedSha(w('c.md', 'uno\n')), normalizedSha(w('d.md', 'dos\n')));
});

// ---------- v1.2: relevos entre sesiones y modelos ----------
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
const gitIn = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=Prueba', '-c', 'user.email=prueba@localhost', ...args],
    { cwd, encoding: 'utf8', timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
// Un «GitHub» local: remoto vacío, una subida inicial con el gancho y, si se pide, una rama de otra sesión.
function remoteWithKit(dir, { ramaConEstado = false, ramaSinEstado = false, verificaciones = 0 } = {}) {
  const remote = path.join(dir, 'gh.git');
  gitIn(dir, 'init', '-q', '--bare', '-b', 'main', remote);
  const up = path.join(dir, 'subida');
  gitIn(dir, 'clone', '-q', remote, up);
  fs.mkdirSync(path.join(up, 'scripts'));
  fs.copyFileSync(path.join(REPO, 'scripts', 'session-start.mjs'), path.join(up, 'scripts', 'session-start.mjs'));
  fs.writeFileSync(path.join(up, 'README.md'), '# kit\n');
  gitIn(up, 'add', '-A'); gitIn(up, 'commit', '-qm', 'kit'); gitIn(up, 'push', '-q', 'origin', 'main');
  if (ramaSinEstado) {
    gitIn(up, 'switch', '-qc', 'claude/verificacion');
    fs.mkdirSync(path.join(up, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(up, 'docs', 'PREFLIGHT.md'), '# Verificación previa\n');
    gitIn(up, 'add', '-A'); gitIn(up, 'commit', '-qm', 'verificación'); gitIn(up, 'push', '-q', 'origin', 'claude/verificacion');
    gitIn(up, 'switch', '-q', 'main');
  }
  // Varias verificaciones previas con main protegida: ramas sin docs/ESTADO.md que, por orden
  // alfabético, quedan antes que la rama con el trabajo.
  for (let i = 1; i <= verificaciones; i++) {
    gitIn(up, 'switch', '-qc', `claude/a-verificacion-${i}`, 'main');
    fs.mkdirSync(path.join(up, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(up, 'docs', 'PREFLIGHT.md'), `# Verificación previa ${i}\n`);
    gitIn(up, 'add', '-A'); gitIn(up, 'commit', '-qm', `verificación ${i}`); gitIn(up, 'push', '-q', 'origin', `claude/a-verificacion-${i}`);
    gitIn(up, 'switch', '-q', 'main');
  }
  if (ramaConEstado) {
    gitIn(up, 'switch', '-qc', 'claude/tramo-1');
    fs.mkdirSync(path.join(up, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(up, 'docs', 'ESTADO.md'), '# Estado\nTramo cerrado: Fases 0 a 1\n');
    gitIn(up, 'add', '-A'); gitIn(up, 'commit', '-qm', 'T1.99 cierre de la Fase 1'); gitIn(up, 'push', '-q', 'origin', 'claude/tramo-1');
  }
  const session = path.join(dir, 'sesion');
  gitIn(dir, 'clone', '-q', '-b', 'main', remote, session);
  return session;
}
const runHook = (session) => {
  const env = { ...process.env }; delete env.CLAUDE_PROJECT_DIR;
  return spawnSync(NODE, [path.join(session, 'scripts', 'session-start.mjs')], { cwd: session, encoding: 'utf8', timeout: 40000, env });
};

test('session-start.mjs: sin estado en main pero con trabajo en otra rama, avisa la reanudación y no la primera sesión', { skip: !hasGit && 'sin git' }, () => {
  const session = remoteWithKit(tmp(), { ramaConEstado: true });
  const r = runHook(session);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /REANUDACIÓN DESDE OTRA RAMA EN GITHUB/);
  assert.match(r.stdout, /claude\/tramo-1/);
  assert.match(r.stdout, /Tramo cerrado: Fases 0 a 1/);
  assert.doesNotMatch(r.stdout, /PRIMERA SESIÓN/);
});

test('session-start.mjs: una rama sin docs/ESTADO.md (por ejemplo, una verificación) no se toma por trabajo empezado', { skip: !hasGit && 'sin git' }, () => {
  const session = remoteWithKit(tmp(), { ramaSinEstado: true });
  const r = runHook(session);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /PRIMERA SESIÓN/);
  assert.match(r.stdout, /ninguna trae docs\/ESTADO\.md/);
});

test('session-start.mjs: encuentra la rama con el trabajo aunque haya muchas ramas de verificación', { skip: !hasGit && 'sin git' }, () => {
  const session = remoteWithKit(tmp(), { ramaConEstado: true, verificaciones: 7 });
  const r = runHook(session);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /REANUDACIÓN DESDE OTRA RAMA EN GITHUB/);
  assert.match(r.stdout, /claude\/tramo-1/);
  assert.doesNotMatch(r.stdout, /PRIMERA SESIÓN/);
});

test('preflight.mjs --solo-kit --push: instala la configuración y los dos subagentes, y los guarda en GitHub', { skip: !hasGit && 'sin git' }, () => {
  const dir = tmp();
  const remote = path.join(dir, 'gh.git');
  gitIn(dir, 'init', '-q', '--bare', '-b', 'main', remote);
  const repo = path.join(dir, 'repo');
  gitIn(dir, 'clone', '-q', remote, repo);
  fs.cpSync(path.join(REPO, 'scripts'), path.join(repo, 'scripts'), { recursive: true });
  fs.cpSync(path.join(REPO, 'config-inicial'), path.join(repo, 'config-inicial'), { recursive: true });
  gitIn(repo, 'add', '-A'); gitIn(repo, 'commit', '-qm', 'kit'); gitIn(repo, 'push', '-q', 'origin', 'main');
  const env = { ...process.env }; delete env.CLAUDE_PROJECT_DIR;
  const r = spawnSync(NODE, [path.join(repo, 'scripts', 'preflight.mjs'), '--solo-kit', '--push'], { cwd: repo, encoding: 'utf8', timeout: 120000, env });
  assert.equal(r.status, 0);
  for (const f of ['.claude/settings.json', '.gitignore', '.claude/agents/Explore.md', '.claude/agents/auditor-independiente.md']) {
    assert.ok(fs.existsSync(path.join(repo, f)), `no instaló ${f}`);
  }
  const enGitHub = gitIn(dir, '--git-dir', remote, 'ls-tree', '-r', '--name-only', 'main');
  for (const f of ['.claude/agents/Explore.md', '.claude/agents/auditor-independiente.md', 'docs/PREFLIGHT.md']) {
    assert.ok(enGitHub.split('\n').includes(f), `no llegó a GitHub: ${f}`);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(repo, '.claude', 'settings.json'), 'utf8'), /CLAUDE_CODE_SUBAGENT_MODEL/);
});

test('preflight.mjs: lee el modelo de los subagentes, detecta claves de Cloudflare en el entorno y encuentra Chromium', async () => {
  const { agentInfo, cloudflareSecretsIn, findChromium } = await import(pathToFileURL(path.join(REPO, 'scripts', 'preflight.mjs')).href);
  for (const [archivo, nombre, modelo] of [['Explore.md', 'Explore', 'haiku'], ['auditor-independiente.md', 'auditor-independiente', 'opus']]) {
    const info = agentInfo(fs.readFileSync(path.join(REPO, 'config-inicial', 'agents', archivo), 'utf8'));
    assert.deepEqual(info, { name: nombre, model: modelo });
  }
  assert.deepEqual(cloudflareSecretsIn({ CF_API_TOKEN: 'x', HOST_SECRET: '', PATH: '/bin', INVITE_CODE: 'abc' }), ['CF_API_TOKEN', 'INVITE_CODE']);
  assert.deepEqual(cloudflareSecretsIn({}), []);
  const dir = tmp();
  assert.equal(findChromium({ PLAYWRIGHT_BROWSERS_PATH: dir }, dir, []), null);
  fs.mkdirSync(path.join(dir, 'chromium-1234'));
  assert.equal(findChromium({ PLAYWRIGHT_BROWSERS_PATH: dir }, dir, []), path.join(dir, 'chromium-1234'));
});

test('preflight.mjs: la verificación completa sin red no exige Docker, PostgreSQL ni FFmpeg y termina en 0', { skip: !hasGit && 'sin git' }, () => {
  const dir = tmp();
  const remote = path.join(dir, 'gh.git');
  gitIn(dir, 'init', '-q', '--bare', '-b', 'main', remote);
  const repo = path.join(dir, 'repo');
  gitIn(dir, 'clone', '-q', remote, repo);
  fs.cpSync(path.join(REPO, 'scripts'), path.join(repo, 'scripts'), { recursive: true });
  fs.cpSync(path.join(REPO, 'config-inicial'), path.join(repo, 'config-inicial'), { recursive: true });
  gitIn(repo, 'add', '-A'); gitIn(repo, 'commit', '-qm', 'kit'); gitIn(repo, 'push', '-q', 'origin', 'main');
  const env = { ...process.env, PATH: path.dirname(NODE) + path.delimiter + process.env.PATH }; delete env.CLAUDE_PROJECT_DIR;
  const r = spawnSync(NODE, [path.join(repo, 'scripts', 'preflight.mjs'), '--sin-red'], { cwd: repo, encoding: 'utf8', timeout: 120000, env });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /VEREDICTO: /);
  const informe = fs.readFileSync(path.join(repo, 'docs', 'PREFLIGHT.md'), 'utf8');
  assert.match(informe, /Verificación previa del entorno · MyZoom/);
  assert.doesNotMatch(informe, /\| [^|]*(Docker|PostgreSQL|FFmpeg)[^|]* \|/, 'no debe haber filas de Docker, PostgreSQL ni FFmpeg');
  assert.match(informe, /Navegador para pruebas de pantalla/);
});

test('kit: ningún archivo del kit tiene un nombre que empiece con punto', () => {
  const ocultos = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'logs'].includes(e.name)) continue;
      const rel = path.relative(REPO, path.join(dir, e.name));
      if (e.name.startsWith('.') && !['.claude', '.gitignore'].includes(e.name)) ocultos.push(rel);
      if (e.isDirectory() && e.name !== '.claude') walk(path.join(dir, e.name));
    }
  };
  for (const d of ['config-inicial', 'scripts', 'tests', 'docs']) if (fs.existsSync(path.join(REPO, d))) walk(path.join(REPO, d));
  assert.deepEqual(ocultos, []);
});

#!/usr/bin/env node
// scripts/session-start.mjs · v1.2
// Muestra el punto de reanudación al abrir, retomar o compactar una sesión.
// Sin dependencias. Nunca falla: ante cualquier error imprime un aviso y termina con código 0.
// Deja una marca en logs/.gancho-inicio.json para que la verificación previa sepa que el gancho corrió.
//
// Orden de decisión: primero mira GitHub. Si esta copia no tiene docs/ESTADO.md pero una rama
// de GitHub sí lo tiene, el trabajo ya empezó en otra sesión: no es una primera sesión.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Raíz del repositorio: la carpeta que contiene scripts/, desde donde sea que se llame.
const root = process.env.CLAUDE_PROJECT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX = 9000;
const out = [];

function readText(rel) {
  const file = join(root, rel);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function firstLines(text, count) {
  return text.split(/\r?\n/).slice(0, count).join('\n').trimEnd();
}

// Dónde está el encargo. En la Fase 0 se mueve a docs/ENCARGO.md; si después aparece otro
// en la raíz, puede ser una versión nueva que subió quien encargó el trabajo.
function encargo() {
  let enRaiz = null;
  try {
    enRaiz = readdirSync(root).filter((name) => /encargo.*\.md$/i.test(name)).sort().pop() || null;
  } catch {
    // sin acceso a la carpeta: se usa el texto genérico
  }
  const enDocs = existsSync(join(root, 'docs', 'ENCARGO.md'));
  const archivo = enDocs ? 'docs/ENCARGO.md' : enRaiz;
  return { archivo, ref: archivo ? 'de ' + archivo : 'del encargo', nuevo: enDocs && enRaiz ? enRaiz : null };
}

// Devuelve la salida de git, '' si no imprimió nada, o null si falló.
function git(args, timeout = 5000) {
  try {
    return execFileSync('git', args, {
      cwd: root, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch {
    return null;
  }
}

// Ramas de GitHub con commits que esta copia no tiene (trabajo de otra sesión sin integrar).
function remoteWorkNotHere() {
  const heads = git(['ls-remote', '--heads', 'origin'], 8000);
  if (heads === null) return null;
  const pending = [];
  for (const line of heads.split('\n').slice(0, 200)) {
    const [sha, ref] = line.split('\t');
    if (!sha || !ref) continue;
    const name = ref.replace('refs/heads/', '');
    const known = git(['cat-file', '-e', `${sha}^{commit}`]) !== null;
    const inHead = known && git(['merge-base', '--is-ancestor', sha, 'HEAD']) !== null;
    if (!inHead) pending.push(name);
  }
  return pending;
}

// Hasta diez nombres de rama, para que la lista no tape lo demás.
const nombres = (ramas) => ramas.slice(0, 10).join(', ') + (ramas.length > 10 ? ` y ${ramas.length - 10} más` : '');

// Trae esas ramas (solo actualiza las referencias remotas: no toca archivos ni ramas locales)
// y busca la más reciente que tenga docs/ESTADO.md. El refspec explícito funciona aunque la
// copia se haya clonado con una sola rama. Las revisa todas, hasta 40: una rama de verificación
// puede quedar, por orden alfabético, antes que la del trabajo. Si hay más, no afirma nada.
function estadoEnRamas(ramas) {
  const lista = ramas.slice(0, 40);
  const spec = lista.map((r) => `+refs/heads/${r}:refs/remotes/origin/${r}`);
  if (git(['fetch', '--quiet', '--no-tags', 'origin', ...spec], 12000) === null) return { trajo: false };
  let mejor = null;
  for (const r of lista) {
    const log = git(['log', '-1', '--format=%ct %cI', `refs/remotes/origin/${r}`]);
    if (!log) continue;
    const [ts, fecha] = log.split(' ');
    const texto = git(['show', `refs/remotes/origin/${r}:docs/ESTADO.md`]);
    if (texto && (!mejor || Number(ts) > mejor.ts)) mejor = { rama: r, ts: Number(ts), fecha, texto };
  }
  return { trajo: true, mejor, todas: lista.length === ramas.length };
}

try {
  try {
    // logs/ está en .gitignore: la marca nunca llega a GitHub.
    mkdirSync(join(root, 'logs'), { recursive: true });
    writeFileSync(join(root, 'logs', '.gancho-inicio.json'),
      JSON.stringify({ fecha: new Date().toISOString(), carpeta: root }));
  } catch {
    // carpeta no escribible: la verificación previa lo informará
  }

  const enc = encargo();
  const estado = readText('docs/ESTADO.md');
  const esRepo = git(['rev-parse', '--is-inside-work-tree']) === 'true';
  const pending = esRepo ? remoteWorkNotHere() : null;
  const hayPendientes = Array.isArray(pending) && pending.length > 0;
  const paso2 = 'el paso 2 del protocolo de reanudación (sección 11.3 ' + enc.ref + ')';
  const empezar = 'Si el mensaje pide empezar el encargo, lee ' + (enc.archivo || 'el encargo')
    + ' completo y ejecuta desde la Fase 0 hasta la fase tope que fije el mensaje; si pide otra cosa'
    + ' —como la verificación previa—, haz solo eso.';

  if (estado === null && hayPendientes) {
    const r = estadoEnRamas(pending);
    if (r.mejor) {
      out.push('REANUDACIÓN DESDE OTRA RAMA EN GITHUB: esta copia no tiene docs/ESTADO.md, pero la rama '
        + r.mejor.rama + ' sí: el trabajo ya empezó en otra sesión.');
      out.push('NO empieces la Fase 0. Primero aplica ' + paso2 + ': trae todas las ramas, integra '
        + r.mejor.rama + ' en main y guarda en GitHub; después sigue el protocolo desde el paso 1.');
      out.push('', `--- docs/ESTADO.md en la rama ${r.mejor.rama} (último commit: ${r.mejor.fecha}) ---`, firstLines(r.mejor.texto, 40));
    } else if (r.trajo && r.todas) {
      out.push('PRIMERA SESIÓN: todavía no existe docs/ESTADO.md, ni aquí ni en las ramas de GitHub.');
      out.push('Hay ramas con commits que esta copia no tiene (' + nombres(pending) + '), pero ninguna trae'
        + ' docs/ESTADO.md: no son trabajo del encargo (por ejemplo, una verificación previa).');
      out.push(empezar);
    } else {
      out.push('POSIBLE REANUDACIÓN DESDE OTRA RAMA: esta copia no tiene docs/ESTADO.md, y GitHub tiene ramas con'
        + ' commits que no están aquí (' + nombres(pending)
        + '), y no pude revisarlas todas.');
      out.push('Antes de la Fase 0, aplica ' + paso2 + ' y revisa si alguna trae docs/ESTADO.md:'
        + ' si la trae, el trabajo ya empezó y debes integrarla; si no, sigue con la Fase 0.');
    }
  } else if (estado === null) {
    out.push('PRIMERA SESIÓN: todavía no existe docs/ESTADO.md.');
    if (esRepo && pending === null) {
      out.push('Ojo: no pude consultar GitHub. Antes de empezar la Fase 0, confirma con ' + paso2
        + ' que ninguna rama trae docs/ESTADO.md; si alguna lo trae, el trabajo ya empezó.');
    }
    out.push(empezar);
  } else {
    out.push('REANUDACIÓN: antes de escribir código, sigue el protocolo de la sección 11.3 ' + enc.ref + '.');
    if (hayPendientes) {
      out.push('ATENCIÓN: GitHub tiene ramas con commits que esta copia no tiene (' + nombres(pending) + ').'
        + ' El estado de abajo puede estar desactualizado: aplica primero ' + paso2 + '.');
    }
    if (enc.nuevo) {
      out.push('ATENCIÓN: hay otro encargo en la raíz (' + enc.nuevo + '). Puede ser una versión nueva:'
        + ' compáralo con docs/ENCARGO.md y aplica la sección 11.3 antes de seguir.');
    }
    out.push('', '--- docs/ESTADO.md (inicio) ---', firstLines(estado, 65));
    const bitacora = readText('docs/BITACORA.md');
    if (bitacora) {
      const entries = bitacora.split(/\r?\n(?=## )/).map((c) => c.trim()).filter((c) => c.startsWith('## '));
      if (entries.length > 0) {
        out.push('', '--- Última entrada de docs/BITACORA.md ---', firstLines(entries[entries.length - 1], 25));
      }
    }
  }

  const preflight = readText('docs/PREFLIGHT.md');
  if (preflight) {
    const verdict = preflight.split(/\r?\n/).find((l) => l.startsWith('## Veredicto'));
    const when = preflight.split(/\r?\n/).find((l) => l.startsWith('_Fecha'));
    if (verdict) out.push('', '--- Última verificación previa ---', verdict.replace(/^## /, ''), when || '');
  }

  const incidentes = readText('docs/INCIDENTES.md');
  if (incidentes) {
    const open = incidentes.split(/\r?\n(?=## )/).filter((c) => c.startsWith('## ') && /Estado\**\s*:\s*\**\s*abierto/i.test(c));
    if (open.length > 0) {
      out.push('', `--- Incidentes abiertos: ${open.length} (léelos antes de seguir) ---`);
      for (const c of open.slice(-3)) out.push(c.split(/\r?\n/)[0]);
    }
  }

  out.push('', '--- Git ---');
  if (!esRepo) {
    out.push('(no es un repositorio Git, o git no está disponible)');
  } else {
    const status = (git(['status', '--short']) || '').split('\n').slice(0, 30).join('\n');
    out.push(
      'Rama actual: ' + (git(['rev-parse', '--abbrev-ref', 'HEAD']) || '(desconocida)'),
      'Últimos commits:\n' + (git(['log', '-5', '--oneline']) || '(sin commits)'),
      'Cambios sin commit:\n' + (status || '(ninguno)'),
    );
    if (pending === null) {
      out.push('Ramas en GitHub: no pude consultarlas ahora (sin red o sin permiso).');
    } else if (hayPendientes) {
      out.push('Ramas de GitHub con commits que esta copia no tiene: ' + nombres(pending));
    } else {
      out.push('Ramas en GitHub: todo su trabajo ya está en esta copia.');
    }
  }
} catch (error) {
  out.push('Aviso: el gancho de inicio no pudo leer el estado (' + (error && error.message) + '). Sigue el protocolo a mano.');
}

let text = out.join('\n');
if (text.length > MAX) text = text.slice(0, MAX) + '\n[recortado]';
process.stdout.write(text + '\n');

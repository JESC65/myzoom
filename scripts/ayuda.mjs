#!/usr/bin/env node
// scripts/ayuda.mjs · v1.1-myzoom · Junta en un solo archivo lo que alguien necesita para ayudarte.
//
// Uso:   node scripts/ayuda.mjs [--push]
//   --push   además guarda el reporte en GitHub (commit de docs/REPORTE_AYUDA.md y push de la rama actual)
//
// Escribe docs/REPORTE_AYUDA.md: estado, bitácora, incidentes, tareas bloqueadas, las últimas
// ejecuciones fallidas de esta máquina, Git y versiones. Quita claves y contraseñas antes de escribir.
// Sin dependencias. Nunca termina en error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Raíz del repositorio: la carpeta que contiene scripts/, desde donde sea que se llame.
const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUSH = process.argv.includes('--push');
const IS_WIN = process.platform === 'win32';
const REPORT = path.join(ROOT, 'docs', 'REPORTE_AYUDA.md');
const MAX_BYTES = 25 * 1024;

function run(cmd, args, timeout = 20) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT, encoding: 'utf8', timeout: timeout * 1000, stdio: ['ignore', 'pipe', 'pipe'], shell: IS_WIN && cmd === 'npm',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' },
  });
  return { ok: !r.error && r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } };
const lines = (t, n) => (t || '').split(/\r?\n/).slice(0, n).join('\n').trimEnd();
const tailLines = (t, n) => (t || '').split(/\r?\n/).slice(-n).join('\n').trimEnd();
const sections = (t) => (t || '').split(/\r?\n(?=## )/).map((s) => s.trim()).filter((s) => s.startsWith('## '));
// Los títulos «## » de la bitácora y los incidentes bajan un nivel para no romper la estructura del reporte.
const demote = (t) => t.replace(/^(#{2,5}) /gm, '#$1 ');
function lima(iso) {
  try {
    return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  } catch { return iso; }
}
function limaNow() {
  try { return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' }).format(new Date()); }
  catch { return new Date().toISOString(); }
}

// Quita secretos: tokens de GitHub, claves de API, claves privadas, contraseñas en URLs y en «nombre=valor».
export function redact(text) {
  return String(text || '')
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, '[clave privada quitada]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[token de GitHub quitado]')
    .replace(/\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}/g, '[clave quitada]')
    .replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '[clave de AWS quitada]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[token quitado]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/-]{8,}=*/gi, '$1[quitado]')
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+@/gi, '$1***@')
    .replace(/(\/\/)[^\s:/@]+@(?=[^\s/]*(?:127\.0\.0\.1|localhost|github\.com))/gi, '$1***@')
    .replace(/((?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|invite[_-]?code|c(?:ó|o)digo|kek|dek|contrase(?:ñ|n)a|clave)[A-Za-z0-9_]*["']?\s*[:=]\s*)(["']?)(?!\[)[^\s"',;]{4,}\2/gi, '$1$2[quitado]$2');
}

function gitInfo() {
  if (run('git', ['rev-parse', '--is-inside-work-tree']).out !== 'true') return null;
  const rama = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out || '?';
  const commit = run('git', ['rev-parse', '--short', 'HEAD']).out || '?';
  const status = run('git', ['status', '--short']).out.split('\n').slice(0, 30).join('\n');
  const log = run('git', ['log', '-8', '--date=format:%Y-%m-%d %H:%M', '--pretty=%h %ad %s']).out;
  const ls = run('git', ['ls-remote', '--heads', 'origin'], 30);
  let pendientes = null;
  if (ls.ok) {
    pendientes = ls.out ? ls.out.split('\n').map((l) => l.split('\t')).filter(([sha]) => {
      const known = run('git', ['cat-file', '-e', `${sha}^{commit}`]).ok;
      return !(known && run('git', ['merge-base', '--is-ancestor', sha, 'HEAD']).ok);
    }).map(([, ref]) => ref.replace('refs/heads/', '')) : [];
  }
  return { rama, commit, status, log, pendientes };
}

function failedRuns() {
  const raw = read('logs/ejecuciones.jsonl');
  if (!raw) return { list: [], ultimoLog: null };
  const all = raw.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const list = all.filter((r) => r.resultado !== 'ok').slice(-5);
  const last = list[list.length - 1];
  const ultimoLog = last && last.registro ? read(last.registro) : null;
  return { list, ultimoLog: ultimoLog ? tailLines(ultimoLog, 60) : null, ultimo: last };
}

function version(cmd, args) { const r = run(cmd, args, 10); return r.ok ? (r.out.split('\n')[0] || '').slice(0, 80) : 'no disponible'; }

function build() {
  const estado = read('docs/ESTADO.md');
  const bitacora = read('docs/BITACORA.md');
  const incid = sections(read('docs/INCIDENTES.md'));
  const abiertos = incid.filter((s) => /Estado\**\s*:\s*\**\s*abierto/i.test(s));
  const tareas = (read('docs/TAREAS.md') || '').split(/\r?\n/);
  const enCurso = tareas.filter((l) => /^\s*-\s*\[~\]/.test(l)).slice(0, 5);
  const bloqueadas = tareas.filter((l) => /^\s*-\s*\[!\]/.test(l)).slice(0, 10);
  const pre = read('docs/PREFLIGHT.md');
  const preVer = pre ? (pre.split(/\r?\n/).find((l) => l.startsWith('## Veredicto')) || '').replace(/^## Veredicto:\s*/, '') : '';
  const preFecha = pre ? ((pre.match(/_Fecha:\s*([^·_]+)/) || [])[1] || '').trim() : '';
  const fallas = failedRuns();
  const g = gitInfo();
  const sesion = process.env.CLAUDE_CODE_REMOTE_SESSION_ID
    ? 'https://claude.ai/code/' + process.env.CLAUDE_CODE_REMOTE_SESSION_ID.replace(/^cse_/, 'session_') : '—';
  let disco = '?';
  try { const s = fs.statfsSync(ROOT); disco = `${((s.bavail * s.bsize) / 1024 ** 3).toFixed(1)} GB libres`; } catch { /* Node antiguo */ }

  const resumen = [
    `- **Verificación previa:** ${preVer ? `${preVer}${preFecha ? ` · ${preFecha}` : ''}` : 'no se ha ejecutado en este repositorio'}`,
    `- **Tareas en curso:** ${enCurso.length ? '\n' + enCurso.map((l) => '  ' + l.trim()).join('\n') : 'ninguna'}`,
    `- **Tareas bloqueadas:** ${bloqueadas.length ? '\n' + bloqueadas.map((l) => '  ' + l.trim()).join('\n') : 'ninguna'}`,
    `- **Incidentes abiertos:** ${abiertos.length ? abiertos.length + '\n' + abiertos.map((s) => '  - ' + s.split(/\r?\n/)[0].replace(/^##\s*/, '')).join('\n') : 'ninguno'}`,
    `- **Última ejecución fallida en esta máquina:** ${fallas.ultimo ? `\`${String(fallas.ultimo.comando).slice(0, 120)}\` → ${fallas.ultimo.resultado} (${lima(fallas.ultimo.inicio)})` : 'ninguna registrada (si la sesión es nueva, los registros de la anterior no existen aquí)'}`,
    `- **Ramas de GitHub con trabajo que esta copia no tiene:** ${g && g.pendientes ? (g.pendientes.join(', ') || 'ninguna') : 'no pude consultar GitHub'}`,
  ].join('\n');

  const parts = {
    cabecera: [
      '# Reporte de ayuda',
      `_Generado: ${limaNow()} (hora de Lima) · Entorno: ${process.env.CLAUDE_CODE_REMOTE === 'true' ? 'nube de Claude Code' : 'equipo local'} · Sesión: ${sesion} · Rama: ${g ? g.rama : '—'} · Commit: ${g ? g.commit : '—'}_`,
      '',
      '> **Cómo usarlo:** copia este archivo completo, pégalo en una conversación con Claude y escribe:',
      '> «Esto es lo que dejó la sesión. Explícame en palabras simples qué pasó y qué debo hacer.»',
      '',
      '## Resumen en una mirada',
      '',
      resumen,
    ].join('\n'),
    estado: ['## Estado (inicio de docs/ESTADO.md)', '', estado ? '````markdown\n' + lines(estado, 60) + '\n````' : '_No existe todavía: el trabajo no ha empezado o la Fase 0 no terminó._'].join('\n'),
    bitacora: ['## Bitácora (últimas 3 entradas)', '', demote(sections(bitacora).slice(-3).map((s) => lines(s, 30)).join('\n\n')) || '_Sin entradas._'].join('\n'),
    incidentes: ['## Incidentes abiertos (texto completo, hasta 2)', '', demote(abiertos.slice(-2).map((s) => lines(s, 45)).join('\n\n')) || '_Ninguno._'].join('\n'),
    fallas: [
      '## Ejecuciones fallidas recientes (en esta máquina)', '',
      fallas.list.length
        ? ['| Inicio | Comando | Resultado | Código | Registro |', '|---|---|---|---|---|',
          ...fallas.list.map((r) => `| ${lima(r.inicio)} | \`${String(r.comando).replace(/[|`]/g, '/').slice(0, 90)}\` | ${r.resultado} | ${r.codigo} | ${r.registro} |`)].join('\n')
        : '_Ninguna registrada con scripts/run.mjs en esta máquina._',
      fallas.ultimoLog ? '\n### Final del registro más reciente con falla\n\n```text\n' + fallas.ultimoLog + '\n```' : '',
    ].join('\n'),
    git: g ? ['## Git', '', '```text', `rama: ${g.rama} · commit: ${g.commit}`, '', 'últimos commits:', g.log || '(sin commits)', '', 'cambios sin commit:', g.status || '(ninguno)', '```'].join('\n')
      : '## Git\n\n_Esta carpeta no es un repositorio Git, o Git no está disponible._',
    sistema: ['## Sistema', '', '```text',
      `node ${process.version} · npm ${version('npm', ['-v'])} · ${version('git', ['--version'])}`,
      `${os.platform()} ${os.release()} ${os.arch()} · ${os.cpus().length} procesadores · ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB de memoria · disco: ${disco}`,
      '```'].join('\n'),
    cierre: [
      '## Qué hacer con esto', '',
      '1. Si arriba hay un **incidente abierto**, su parte «Explicación para Javier» —para quien encargó el trabajo— dice qué pasó y qué se necesita de ti.',
      '2. Si la **verificación previa** no dice «LISTO», pide en una sesión nueva: «Ejecuta node scripts/preflight.mjs --push y explícame el resultado».',
      '3. Si nada de eso aclara el problema, copia este archivo completo y pégalo en una conversación con Claude.',
      '',
      '_Este reporte no contiene claves ni contraseñas: se quitaron antes de escribirlo._',
      '',
    ].join('\n'),
  };

  const order = ['cabecera', 'estado', 'bitacora', 'incidentes', 'fallas', 'git', 'sistema', 'cierre'];
  const assemble = () => redact(order.map((k) => parts[k]).filter(Boolean).join('\n\n'));
  let text = assemble();
  // Si es muy largo, recorta primero lo menos importante.
  const trims = [
    () => { parts.fallas = parts.fallas.replace(/```text\n[\s\S]*?```/, (m) => '```text\n' + tailLines(m.slice(8, -3), 25) + '\n```'); },
    () => { parts.bitacora = ['## Bitácora (última entrada)', '', demote(lines(sections(bitacora).slice(-1)[0] || '_Sin entradas._', 25))].join('\n'); },
    () => { parts.estado = parts.estado.split('\n').slice(0, 35).join('\n') + '\n````'; },
    () => { parts.incidentes = parts.incidentes.split('\n').slice(0, 40).join('\n'); },
  ];
  for (const t of trims) { if (Buffer.byteLength(text) <= MAX_BYTES) break; t(); text = assemble(); }
  if (Buffer.byteLength(text) > MAX_BYTES) text = text.slice(0, MAX_BYTES - 200) + '\n\n[reporte recortado por tamaño]\n';
  return { text, resumen, g };
}

function main() {
  const { text, resumen, g } = build();
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, text);
  let pushed = '';
  if (PUSH && g) {
    const id = run('git', ['config', 'user.email']).out ? [] : ['-c', 'user.name=Reporte de ayuda', '-c', 'user.email=ayuda@localhost'];
    run('git', ['add', 'docs/REPORTE_AYUDA.md']);
    run('git', [...id, 'commit', '-m', 'Reporte de ayuda', '--', 'docs/REPORTE_AYUDA.md'], 30);
    const p = run('git', ['push', '-u', 'origin', 'HEAD'], 90);
    pushed = p.ok ? `Guardado en GitHub, rama «${g.rama}»: docs/REPORTE_AYUDA.md`
      : `No pude guardarlo en GitHub (${(p.err.split('\n').pop() || '').slice(0, 160)}). El archivo quedó en esta máquina.`;
  }
  console.log('Reporte de ayuda listo: docs/REPORTE_AYUDA.md (' + Buffer.byteLength(text) + ' bytes, sin claves ni contraseñas)');
  if (pushed) console.log(pushed);
  console.log('\nResumen:\n' + redact(resumen.replace(/\*\*/g, '')));
}

// Solo se ejecuta si se llama directamente (las pruebas importan redact sin generar el reporte).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (e) {
    console.log('No pude generar el reporte completo: ' + (e && e.message));
    console.log('Copia este mensaje y pide ayuda; mientras tanto, docs/ESTADO.md y docs/BITACORA.md tienen lo esencial.');
  }
  process.exitCode = 0;
}

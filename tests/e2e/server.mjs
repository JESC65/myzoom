// E2E harness: runs the real Worker module (src/worker/index.ts, via Node type stripping)
// behind a tiny HTTP server that emulates the Workers Static Assets binding (SPA mode)
// over dist/client. Test-only control routes under /__test/ change the mock env.
// This file is never deployed (wrangler only bundles src/worker).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../../src/worker/index.ts';
import { defaultEnv } from './test-env.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist', 'client');
const PORT = Number(process.env.PORT || 8790);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Falta dist/client/index.html: ejecuta "npm run build" antes de las pruebas de interfaz.');
  process.exit(1);
}

let env = defaultEnv();

const ASSETS = {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
    let file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    const body = fs.readFileSync(file);
    return new Response(request.method === 'HEAD' ? null : body, { headers: { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' } });
  },
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === '/__test/env' && req.method === 'POST') {
      const patch = JSON.parse((await readBody(req)).toString() || '{}');
      for (const [k, v] of Object.entries(patch)) { if (v === null) delete env[k]; else env[k] = String(v); }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname === '/__test/reset' && req.method === 'POST') {
      env = defaultEnv();
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      return;
    }
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v); else if (Array.isArray(v)) headers.set(k, v.join(', '));
    const request = new Request(url, { method: req.method, headers, body });
    const response = await worker.fetch(request, { ...env, ASSETS });
    const out = {};
    response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) out['set-cookie'] = cookies;
    res.writeHead(response.status, out);
    res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
  } catch (e) {
    console.error('[harness]', e);
    res.writeHead(500).end('harness error');
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`MyZoom e2e harness on http://localhost:${PORT}`));

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../../src/worker/index.ts';
import { createHostToken } from '../../src/worker/security.ts';
import {
  baseEnv, makeHandler, req, readJson, hostCookie, captureLogs, fakeApi, jsonRes,
  GOOD_GUEST, SECRETS, OPENS_MS, CLOSES_MS, NOW_OPEN, ORIGIN,
} from './helpers.ts';

const MIN = 60_000;
const presetSent = (calls: { body: unknown }[]) => (calls.at(-1)?.body as { preset_name?: string } | undefined)?.preset_name;

describe('guest entry: roles decided by the server (section 4.4 / 6)', () => {
  it('valid guest gets a token, display name and mode; API receives PRESET_GUEST and expires_on = close', async () => {
    const { handler, calls } = makeHandler();
    const res = await handler.fetch(req('/api/entrar', { body: GOOD_GUEST }), baseEnv());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.equal(res.headers.get('Content-Type'), 'application/json; charset=utf-8');
    const body = await readJson(res);
    assert.equal(body.nombreVisible, 'Carlos Prueba · Toronto');
    assert.equal(body.modo, 'real');
    assert.equal(typeof body.authToken, 'string');
    assert.equal(calls.length, 1);
    const sent = calls[0]!.body as Record<string, string>;
    assert.equal(sent.preset_name, 'group_call_participant');
    assert.equal(sent.expires_on, new Date(CLOSES_MS).toISOString());
    assert.match(sent.custom_participant_id!, /^guest-[0-9a-f-]{36}$/);
    assert.equal(sent.name, 'Carlos Prueba · Toronto');
  });

  const attempts: [string, Record<string, unknown>][] = [
    ['preset_name host', { preset_name: 'group_call_host' }],
    ['preset host', { preset: 'group_call_host' }],
    ['presetName host', { presetName: 'group_call_host' }],
    ['role host', { role: 'host' }],
    ['rol anfitrion', { rol: 'anfitrion' }],
    ['isHost true', { isHost: true }],
    ['isHost string', { isHost: 'true' }],
    ['host object', { host: { preset_name: 'group_call_host' } }],
    ['array preset', { preset_name: ['group_call_host'] }],
    ['custom id host', { custom_participant_id: 'host-123' }],
    ['clave', { clave: SECRETS.HOST_SECRET }],
  ];
  for (const [label, extra] of attempts) {
    it(`ignores escalation attempt: ${label}`, async () => {
      const { handler, calls } = makeHandler();
      const res = await handler.fetch(req('/api/entrar', { body: { ...GOOD_GUEST, ...extra } }), baseEnv());
      assert.equal(res.status, 200);
      assert.equal(presetSent(calls), 'group_call_participant');
      assert.match((calls[0]!.body as Record<string, string>).custom_participant_id!, /^guest-/);
    });
  }

  it('ignores duplicated keys in raw JSON (last one wins, preset still guest)', async () => {
    const { handler, calls } = makeHandler();
    const raw = `{"nombre":"Carlos Prueba","ciudad":"Toronto","codigo":"${SECRETS.INVITE_CODE}","preset_name":"group_call_participant","preset_name":"group_call_host","role":"guest","role":"host"}`;
    const res = await handler.fetch(req('/api/entrar', { rawBody: raw }), baseEnv());
    assert.equal(res.status, 200);
    assert.equal(presetSent(calls), 'group_call_participant');
  });

  it('a host cookie does not turn /api/entrar into a host credential', async () => {
    const { handler, calls } = makeHandler();
    const env = baseEnv();
    const cookie = await hostCookie(handler, env);
    const res = await handler.fetch(req('/api/entrar', { body: GOOD_GUEST, cookie }), env);
    assert.equal(res.status, 200);
    assert.equal(presetSent(calls), 'group_call_participant');
  });
});

describe('guest entry: invite code and window', () => {
  it('wrong, missing or non-string code → 403 with the exact message', async () => {
    for (const codigo of ['otro-codigo', '', undefined, 12345678, SECRETS.INVITE_CODE + ' ', SECRETS.INVITE_CODE.toUpperCase()]) {
      const { handler, calls } = makeHandler();
      const res = await handler.fetch(req('/api/entrar', { body: { ...GOOD_GUEST, codigo } }), baseEnv());
      assert.equal(res.status, 403, String(codigo));
      assert.equal((await readJson(res)).error, 'El enlace no es válido. Pide el enlace actualizado en el grupo de la promoción.');
      assert.equal(calls.length, 0);
    }
  });

  const edges: [string, number, number][] = [
    ['one minute before opening', OPENS_MS - MIN, 403],
    ['at opening', OPENS_MS, 200],
    ['one minute before closing', CLOSES_MS - MIN, 200],
    ['at closing', CLOSES_MS, 403],
  ];
  for (const [label, now, status] of edges) {
    it(`window edge: ${label} → ${status}`, async () => {
      const { handler, calls } = makeHandler({ now });
      const res = await handler.fetch(req('/api/entrar', { body: GOOD_GUEST }), baseEnv());
      assert.equal(res.status, status);
      if (status === 200) assert.equal((calls[0]!.body as { expires_on: string }).expires_on, new Date(CLOSES_MS).toISOString());
      else assert.equal(calls.length, 0);
    });
  }

  it('before opening: message with Lima date and time', async () => {
    const { handler } = makeHandler({ now: OPENS_MS - MIN });
    const body = await readJson(await handler.fetch(req('/api/entrar', { body: GOOD_GUEST }), baseEnv()));
    assert.equal(body.error, 'La reunión todavía no empieza. Se abre el sábado 21 de noviembre a las 8:00 a. m. (hora de Lima).');
  });

  it('after closing: thank-you message', async () => {
    const { handler } = makeHandler({ now: CLOSES_MS + 1 });
    const body = await readJson(await handler.fetch(req('/api/entrar', { body: GOOD_GUEST }), baseEnv()));
    assert.equal(body.error, 'La reunión ya terminó. ¡Gracias por acompañarnos!');
  });

  it('incomplete configuration → 503 friendly message, no details', async () => {
    const { handler, calls } = makeHandler();
    for (const env of [baseEnv({ RTK_MEETING_ID: '' }), baseEnv({ PRESET_GUEST: '' }), baseEnv({ CF_API_TOKEN: '' }), baseEnv({ EVENT_CLOSES_AT: 'mal' }), baseEnv({ INVITE_CODE: '123' })]) {
      const res = await handler.fetch(req('/api/entrar', { body: GOOD_GUEST }), env);
      assert.equal(res.status, 503);
      const body = await readJson(res);
      assert.equal(body.error, 'La sala todavía no está lista. Avísale al organizador por WhatsApp.');
    }
    assert.equal(calls.length, 0);
  });

  it('Cloudflare failure → 502 with a Spanish message', async () => {
    const api = fakeApi(() => jsonRes({}, 500));
    const { handler } = makeHandler({ fetch: api.fetch });
    const res = await handler.fetch(req('/api/entrar', { body: GOOD_GUEST }), baseEnv());
    assert.equal(res.status, 502);
    assert.match(String((await readJson(res)).error), /No pudimos conectarte/);
  });
});

describe('guest entry: input validation (section 14.1 Entradas)', () => {
  const bad: [string, Record<string, unknown>, 'nombre' | 'ciudad'][] = [
    ['empty name', { nombre: '' }, 'nombre'],
    ['spaces-only name', { nombre: '    ' }, 'nombre'],
    ['one-letter name', { nombre: 'A' }, 'nombre'],
    ['61-char name', { nombre: 'a'.repeat(61) }, 'nombre'],
    ['name only control chars', { nombre: '\u0000\u0007\u001b' }, 'nombre'],
    ['name not a string', { nombre: { x: 1 } }, 'nombre'],
    ['empty city', { ciudad: '' }, 'ciudad'],
    ['51-char city', { ciudad: 'b'.repeat(51) }, 'ciudad'],
    ['city as number', { ciudad: 42 }, 'ciudad'],
  ];
  for (const [label, override, campo] of bad) {
    it(`400 for ${label}`, async () => {
      const { handler, calls } = makeHandler();
      const res = await handler.fetch(req('/api/entrar', { body: { ...GOOD_GUEST, ...override } }), baseEnv());
      assert.equal(res.status, 400);
      const body = await readJson(res);
      assert.equal(body.campo, campo);
      assert.match(String(body.error), campo === 'nombre' ? /nombre y apellido/ : /ciudad/);
      assert.equal(calls.length, 0);
    });
  }

  it('cleans control characters, bidi overrides and HTML brackets; normalizes NFC; keeps emojis', async () => {
    const { handler, calls } = makeHandler();
    const res = await handler.fetch(req('/api/entrar', {
      body: { ...GOOD_GUEST, nombre: '  José <b>Pérez</b>\u0007‮  ', ciudad: 'Miami 🌴\u0000' },
    }), baseEnv());
    assert.equal(res.status, 200);
    const name = (calls[0]!.body as { name: string }).name;
    assert.equal(name, 'José bPérez/b · Miami 🌴');
    assert.equal(name, name.normalize('NFC'));
  });

  it('accepts exactly 60 and 50 characters (emoji counts as one)', async () => {
    const { handler } = makeHandler();
    const res = await handler.fetch(req('/api/entrar', { body: { ...GOOD_GUEST, nombre: '😀'.repeat(60), ciudad: 'c'.repeat(50) } }), baseEnv());
    assert.equal(res.status, 200);
  });

  it('body over 2 KB → 413 (declared or streamed)', async () => {
    const { handler } = makeHandler();
    const big = { ...GOOD_GUEST, relleno: 'x'.repeat(2100) };
    const res = await handler.fetch(req('/api/entrar', { body: big }), baseEnv());
    assert.equal(res.status, 413);
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify(big))); c.close(); } });
    const r2 = new Request(`${ORIGIN}/api/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: stream, duplex: 'half' } as RequestInit);
    assert.equal((await handler.fetch(r2, baseEnv())).status, 413);
  });

  it('content type other than JSON → 415', async () => {
    const { handler } = makeHandler();
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', '']) {
      const res = await handler.fetch(req('/api/entrar', { rawBody: JSON.stringify(GOOD_GUEST), headers: { 'Content-Type': type } }), baseEnv());
      assert.equal(res.status, 415, type);
    }
    const ok = await handler.fetch(req('/api/entrar', { rawBody: JSON.stringify(GOOD_GUEST), headers: { 'Content-Type': 'application/json; charset=utf-8' } }), baseEnv());
    assert.equal(ok.status, 200);
  });

  it('foreign Origin → 403; missing Origin is accepted', async () => {
    const { handler } = makeHandler();
    const res = await handler.fetch(req('/api/entrar', { body: GOOD_GUEST, origin: 'https://evil.example' }), baseEnv());
    assert.equal(res.status, 403);
    assert.match(String((await readJson(res)).error), /no viene de la página/);
    assert.equal((await handler.fetch(req('/api/entrar', { body: GOOD_GUEST, origin: null }), baseEnv())).status, 200);
  });

  it('invalid JSON, arrays and null → 400', async () => {
    const { handler } = makeHandler();
    for (const raw of ['{', '[]', 'null', '"x"', '￿']) {
      assert.equal((await handler.fetch(req('/api/entrar', { rawBody: raw }), baseEnv())).status, 400, raw);
    }
  });
});

describe('fallback (section 4.6)', () => {
  const FALLBACK = 'https://meet.example/sala-respaldo';

  it('GET / and /?c=CODE → 302 to FALLBACK_URL without the code or query, no-store', async () => {
    const { handler } = makeHandler();
    for (const path of ['/', `/?c=${SECRETS.INVITE_CODE}`, `/?c=${SECRETS.INVITE_CODE}&x=1`, '/index.html?c=abc']) {
      const res = await handler.fetch(req(path), baseEnv({ FALLBACK_URL: FALLBACK }));
      assert.equal(res.status, 302, path);
      assert.equal(res.headers.get('Location'), FALLBACK);
      assert.ok(!res.headers.get('Location')!.includes(SECRETS.INVITE_CODE));
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
    }
  });

  it('invalid FALLBACK_URL is ignored (app served)', async () => {
    const { handler } = makeHandler();
    for (const bad of ['http://meet.example/x', 'https://u:p@meet.example/', 'nada']) {
      const res = await handler.fetch(req('/?c=abc'), baseEnv({ FALLBACK_URL: bad }));
      assert.equal(res.status, 200, bad);
      assert.match(await res.text(), /<div id="root">/);
    }
  });

  it('POST /api/entrar → 409 with respaldo', async () => {
    const { handler, calls } = makeHandler();
    const res = await handler.fetch(req('/api/entrar', { body: GOOD_GUEST }), baseEnv({ FALLBACK_URL: FALLBACK }));
    assert.equal(res.status, 409);
    const body = await readJson(res);
    assert.equal(body.respaldo, FALLBACK);
    assert.match(String(body.error), /Nos cambiamos de sala/);
    assert.equal(calls.length, 0);
  });

  it('host is never redirected and host API keeps working', async () => {
    const { handler } = makeHandler();
    const env = baseEnv({ FALLBACK_URL: FALLBACK });
    for (const path of ['/anfitrion', '/anfitrion/']) {
      const res = await handler.fetch(req(path), env);
      assert.equal(res.status, 200, path);
    }
    const cookie = await hostCookie(handler, env);
    const diag = await handler.fetch(req('/api/anfitrion/diagnostico', { cookie }), env);
    assert.equal(diag.status, 200);
    const cred = await handler.fetch(req('/api/anfitrion/credencial', { body: {}, cookie }), env);
    assert.equal(cred.status, 200);
  });

  it('/api/estado reports respaldo: true without the URL', async () => {
    const { handler } = makeHandler();
    const res = await handler.fetch(req('/api/estado'), baseEnv({ FALLBACK_URL: FALLBACK }));
    const body = await readJson(res);
    assert.equal(body.respaldo, true);
    assert.ok(!JSON.stringify(body).includes('meet.example'));
  });
});

describe('/api/estado', () => {
  it('returns the public shape, no-store, no secrets', async () => {
    const { handler } = makeHandler();
    const res = await handler.fetch(req('/api/estado'), baseEnv());
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    const body = await readJson(res);
    assert.deepEqual(Object.keys(body).sort(), ['abierto', 'abreEn', 'cierraEn', 'modo', 'respaldo']);
    assert.equal(body.abierto, true);
    assert.equal(body.respaldo, false);
    assert.equal(body.modo, 'real');
    assert.equal(body.cierraEn, new Date(CLOSES_MS).toISOString());
    const text = JSON.stringify(body);
    for (const s of Object.values(SECRETS)) assert.ok(!text.includes(s));
  });

  it('modo ensayo with MOCK_RTK=true; abierto false outside the window', async () => {
    const { handler } = makeHandler({ now: OPENS_MS - 1 });
    const body = await readJson(await handler.fetch(req('/api/estado'), baseEnv({ MOCK_RTK: 'true' })));
    assert.equal(body.modo, 'ensayo');
    assert.equal(body.abierto, false);
  });
});

describe('host (section 4.5)', () => {
  it('wrong secret → 403; right secret → cookie with the right attributes', async () => {
    const { handler } = makeHandler();
    const env = baseEnv();
    const bad = await handler.fetch(req('/api/anfitrion/entrar', { body: { clave: 'no-es-la-clave-correcta' } }), env);
    assert.equal(bad.status, 403);
    assert.equal(bad.headers.get('Set-Cookie'), null);
    const nonString = await handler.fetch(req('/api/anfitrion/entrar', { body: { clave: ['x'] } }), env);
    assert.equal(nonString.status, 403);
    const ok = await handler.fetch(req('/api/anfitrion/entrar', { body: { clave: SECRETS.HOST_SECRET } }), env);
    assert.equal(ok.status, 200);
    assert.deepEqual(await readJson(ok), { ok: true });
    const set = ok.headers.get('Set-Cookie')!;
    assert.match(set, /^__Host-myzoom_host=v1\.\d+\.[\w-]{43}; /);
    for (const part of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/', `Expires=${new Date(CLOSES_MS).toUTCString()}`]) assert.ok(set.includes(part), part);
  });

  it('HOST_SECRET shorter than 12 → 503 and nobody can log in', async () => {
    const { handler } = makeHandler();
    const res = await handler.fetch(req('/api/anfitrion/entrar', { body: { clave: 'corta' } }), baseEnv({ HOST_SECRET: 'corta' }));
    assert.equal(res.status, 503);
  });

  it('without cookie: credencial, diagnostico, sesion and crear-reunion → 401', async () => {
    const { handler, calls } = makeHandler();
    const env = baseEnv({ RTK_MEETING_ID: '' });
    assert.equal((await handler.fetch(req('/api/anfitrion/credencial', { body: {} }), env)).status, 401);
    assert.equal((await handler.fetch(req('/api/anfitrion/diagnostico'), env)).status, 401);
    assert.equal((await handler.fetch(req('/api/anfitrion/sesion'), env)).status, 401);
    assert.equal((await handler.fetch(req('/api/anfitrion/crear-reunion', { body: {} }), env)).status, 401);
    assert.equal(calls.length, 0);
  });

  it('altered, expired or other-key cookies → 401', async () => {
    const { handler } = makeHandler();
    const env = baseEnv();
    const good = await hostCookie(handler, env);
    const value = good.split('=')[1]!;
    const altered = `__Host-myzoom_host=${value.slice(0, -2)}${value.endsWith('AA') ? 'BB' : 'AA'}`;
    const expired = `__Host-myzoom_host=${await createHostToken(NOW_OPEN - 1000, SECRETS.HOST_SECRET)}`;
    const otherKey = `__Host-myzoom_host=${await createHostToken(CLOSES_MS, 'otra-clave-de-anfitrion')}`;
    const wrongName = `myzoom_host=${value}`;
    for (const cookie of [altered, expired, otherKey, wrongName]) {
      assert.equal((await handler.fetch(req('/api/anfitrion/credencial', { body: {}, cookie }), env)).status, 401, cookie);
      assert.equal((await handler.fetch(req('/api/anfitrion/diagnostico', { cookie }), env)).status, 401, cookie);
    }
  });

  it('changing HOST_SECRET invalidates existing cookies', async () => {
    const { handler } = makeHandler();
    const cookie = await hostCookie(handler, baseEnv());
    const res = await handler.fetch(req('/api/anfitrion/sesion', { cookie }), baseEnv({ HOST_SECRET: 'una-clave-nueva-larga' }));
    assert.equal(res.status, 401);
  });

  it('valid cookie: session ok, host credential with PRESET_HOST and HOST_DISPLAY_NAME', async () => {
    const { handler, calls } = makeHandler();
    const env = baseEnv();
    const cookie = await hostCookie(handler, env);
    assert.equal((await handler.fetch(req('/api/anfitrion/sesion', { cookie }), env)).status, 200);
    const res = await handler.fetch(req('/api/anfitrion/credencial', { body: {}, cookie }), env);
    assert.equal(res.status, 200);
    const body = await readJson(res);
    assert.equal(body.nombreVisible, 'Salón · Promoción 81');
    const sent = calls.at(-1)!.body as Record<string, string>;
    assert.equal(sent.preset_name, 'group_call_host');
    assert.equal(sent.name, 'Salón · Promoción 81');
    assert.match(sent.custom_participant_id!, /^host-/);
    assert.equal(sent.expires_on, new Date(CLOSES_MS).toISOString());
  });

  it('host credential also respects the window', async () => {
    const env = baseEnv();
    const early = makeHandler({ now: OPENS_MS - MIN });
    const cookie = await hostCookie(early.handler, env);
    assert.equal((await early.handler.fetch(req('/api/anfitrion/credencial', { body: {}, cookie }), env)).status, 403);
  });

  it('host can log in and see diagnostics even when EVENT_CLOSES_AT is past or missing', async () => {
    for (const env of [baseEnv({ EVENT_CLOSES_AT: '' }), baseEnv()]) {
      const { handler } = makeHandler({ now: CLOSES_MS + 3_600_000 });
      const cookie = await hostCookie(handler, env);
      assert.equal((await handler.fetch(req('/api/anfitrion/diagnostico', { cookie }), env)).status, 200);
    }
  });

  it('logout clears the cookie', async () => {
    const { handler } = makeHandler();
    const res = await handler.fetch(req('/api/anfitrion/salir', { body: {} }), baseEnv());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('Set-Cookie')!, /^__Host-myzoom_host=; .*Max-Age=0/);
    const foreign = await handler.fetch(req('/api/anfitrion/salir', { body: {}, origin: 'https://evil.example' }), baseEnv());
    assert.equal(foreign.status, 403);
  });

  it('mock mode over http://localhost uses the same __Host- cookie (D-007)', async () => {
    const handler = createHandler({ now: () => NOW_OPEN });
    const env = baseEnv({ MOCK_RTK: 'true' });
    const login = new Request('http://localhost:8787/api/anfitrion/entrar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8787' }, body: JSON.stringify({ clave: SECRETS.HOST_SECRET }),
    });
    const res = await handler.fetch(login, env);
    const set = res.headers.get('Set-Cookie')!;
    assert.match(set, /^__Host-myzoom_host=/);
    assert.ok(set.includes('Secure'));
    const cred = await handler.fetch(new Request('http://localhost:8787/api/anfitrion/credencial', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8787', Cookie: set.split(';')[0]! }, body: '{}',
    }), env);
    assert.equal(cred.status, 200);
    assert.equal(cred.headers.get('X-MyZoom-Mock-Preset'), 'group_call_host');
    assert.match(String((await readJson(cred)).authToken), /^mock-/);
  });
});

describe('API routing and pages', () => {
  it('unknown API route → 404 JSON; wrong method on a known route → 405', async () => {
    const { handler } = makeHandler();
    const r404 = await handler.fetch(req('/api/no-existe'), baseEnv());
    assert.equal(r404.status, 404);
    assert.equal(r404.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.equal(r404.headers.get('Cache-Control'), 'no-store');
    assert.ok((await readJson(r404)).error);
    const r405 = await handler.fetch(req('/api/entrar'), baseEnv());
    assert.equal(r405.status, 405);
  });

  it('any other page path serves the app with security headers', async () => {
    const { handler } = makeHandler();
    const res = await handler.fetch(req('/cualquier/ruta'), baseEnv());
    assert.equal(res.status, 200);
    const csp = res.headers.get('Content-Security-Policy')!;
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("object-src 'none'"));
    assert.equal(res.headers.get('Referrer-Policy'), 'no-referrer');
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.match(res.headers.get('Permissions-Policy')!, /camera=\(self\).*microphone=\(self\)/);
  });

  it('non-HTML assets get nosniff but not the HTML CSP/no-store', async () => {
    const { handler } = makeHandler();
    const res = await handler.fetch(req('/assets/app.js'), baseEnv());
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(res.headers.get('Content-Security-Policy'), null);
  });
});

describe('logs (section 6)', () => {
  it('never contain token, secrets, invite code or guest names', async () => {
    const out = await captureLogs(async () => {
      const failing = fakeApi(() => jsonRes({ echo: SECRETS.CF_API_TOKEN }, 500));
      const { handler } = makeHandler({ fetch: failing.fetch });
      const env = baseEnv();
      await handler.fetch(req('/api/entrar', { body: { ...GOOD_GUEST, nombre: 'Nombre Secreto' } }), env);
      await handler.fetch(req('/api/entrar', { body: { ...GOOD_GUEST, codigo: 'malo-123' } }), env);
      await handler.fetch(req('/api/anfitrion/entrar', { body: { clave: 'clave-incorrecta-123' } }), env);
      await handler.fetch(req('/api/entrar', { body: GOOD_GUEST }), baseEnv({ RTK_MEETING_ID: '' }));
      const cookie = await hostCookie(handler, env);
      await handler.fetch(req('/api/anfitrion/credencial', { body: {}, cookie }), env);
      await handler.fetch(req('/api/anfitrion/diagnostico', { cookie }), env);
      await handler.fetch(req('/api/anfitrion/crear-reunion', { body: {}, cookie }), baseEnv({ RTK_MEETING_ID: '' }));
    });
    assert.ok(out.length > 0, 'expected some error logs');
    for (const s of [...Object.values(SECRETS), 'Nombre Secreto', 'Carlos Prueba', 'eyJhbGciOiJSUzI1NiJ9', 'malo-123', 'clave-incorrecta-123']) {
      assert.ok(!out.includes(s), `log leaked: ${s}`);
    }
  });
});

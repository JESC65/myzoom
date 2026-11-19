import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DiagnosticsResponse } from '../../src/shared/contracts.ts';
import { createHandler } from '../../src/worker/index.ts';
import { baseEnv, makeHandler, req, readJson, hostCookie, fakeApi, jsonRes, fixture, SECRETS, OPENS_MS, NOW_OPEN, ORIGIN } from './helpers.ts';
import type { Env } from '../../src/worker/config.ts';

async function diag(env: Env, opts: { now?: number; fetch?: typeof fetch } = {}) {
  const { handler, calls } = makeHandler(opts);
  const cookie = await hostCookie(handler, env);
  const res = await handler.fetch(req('/api/anfitrion/diagnostico', { cookie }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  const text = await res.text();
  return { body: JSON.parse(text) as DiagnosticsResponse, text, calls };
}

const find = (d: DiagnosticsResponse, nombre: string) => d.checks.find((c) => c.nombre === nombre);

describe('diagnostics (section 4.7)', () => {
  it('all good: every check ok, presets listed, invite link ready', async () => {
    const { body } = await diag(baseEnv());
    const notOk = body.checks.filter((c) => c.estado !== 'ok');
    assert.deepEqual(notOk, []);
    assert.equal(body.modo, 'real');
    assert.equal(body.puedeCrearReunion, false);
    assert.equal(body.enlaceInvitacion, `${ORIGIN}/?c=${SECRETS.INVITE_CODE}`);
    assert.deepEqual(body.presetsDisponibles, ['group_call_host', 'group_call_participant', 'webinar_presenter', 'webinar_viewer']);
    assert.equal(body.ventana.abierto, true);
    assert.match(body.ventana.cierraEnLima!, /domingo 22 de noviembre a las 6:00 a\. m\./);
  });

  it('never returns secret values (only the invite link contains the code)', async () => {
    const { body, text } = await diag(baseEnv());
    assert.ok(!text.includes(SECRETS.CF_API_TOKEN));
    assert.ok(!text.includes(SECRETS.HOST_SECRET));
    const withoutLink = JSON.stringify({ ...body, enlaceInvitacion: null });
    assert.ok(!withoutLink.includes(SECRETS.INVITE_CODE));
  });

  const missing: [keyof Env, RegExp][] = [
    ['CF_API_TOKEN', /Secreto CF_API_TOKEN/],
    ['HOST_SECRET', /Secreto HOST_SECRET/],
    ['INVITE_CODE', /Secreto INVITE_CODE/],
    ['CF_ACCOUNT_ID', /Variable CF_ACCOUNT_ID/],
    ['RTK_APP_ID', /Variable RTK_APP_ID/],
    ['RTK_MEETING_ID', /Variable RTK_MEETING_ID/],
    ['PRESET_GUEST', /Variable PRESET_GUEST/],
    ['PRESET_HOST', /Variable PRESET_HOST/],
    ['EVENT_OPENS_AT', /Variable EVENT_OPENS_AT/],
    ['EVENT_CLOSES_AT', /Variable EVENT_CLOSES_AT/],
  ];
  for (const [key, re] of missing) {
    if (key === 'HOST_SECRET') continue; // without HOST_SECRET nobody can log in (tested in routes)
    it(`missing ${key} → its own row in Spanish with "qué hacer"`, async () => {
      const { body } = await diag(baseEnv({ [key]: '' }));
      const row = body.checks.find((c) => re.test(c.nombre));
      assert.ok(row, `row for ${key}`);
      assert.equal(row.estado, 'falla');
      assert.match(row.detalle, /no está definido/);
      assert.ok(row.queHacer.length > 10, 'queHacer must say what to do');
    });
  }

  it('short INVITE_CODE → falla and no invite link', async () => {
    const { body } = await diag(baseEnv({ INVITE_CODE: 'abc' }));
    assert.equal(find(body, 'Secreto INVITE_CODE')!.estado, 'falla');
    assert.equal(body.enlaceInvitacion, null);
  });

  it('invalid dates and inverted window are reported', async () => {
    const { body } = await diag(baseEnv({ EVENT_OPENS_AT: '2026-11-23T00:00:00-05:00' }));
    assert.equal(find(body, 'Variable EVENT_CLOSES_AT')!.estado, 'falla');
    assert.equal(find(body, 'Ventana horaria')!.estado, 'falla');
  });

  it('invalid FALLBACK_URL shown in red; valid one as active warning', async () => {
    const bad = await diag(baseEnv({ FALLBACK_URL: 'http://inseguro.example' }));
    assert.equal(find(bad.body, 'Variable FALLBACK_URL')!.estado, 'falla');
    const good = await diag(baseEnv({ FALLBACK_URL: 'https://meet.example/x' }));
    assert.equal(find(good.body, 'Variable FALLBACK_URL')!.estado, 'aviso');
    assert.match(find(good.body, 'Variable FALLBACK_URL')!.detalle, /ACTIVO/);
  });

  it('401/403 from Cloudflare → "el token no tiene el permiso correcto"', async () => {
    const api = fakeApi(() => jsonRes(fixture('error-401'), 401));
    const { body } = await diag(baseEnv(), { fetch: api.fetch });
    const row = find(body, 'API de Cloudflare')!;
    assert.equal(row.estado, 'falla');
    assert.match(row.detalle, /token no tiene el permiso correcto/);
  });

  it('unknown preset → falla with the list of existing presets', async () => {
    const { body } = await diag(baseEnv({ PRESET_GUEST: 'invitado_inexistente' }));
    const row = find(body, 'Preset PRESET_GUEST')!;
    assert.equal(row.estado, 'falla');
    assert.match(row.detalle, /group_call_participant/);
  });

  it('INACTIVE meeting and unknown meeting are failures', async () => {
    const inactive = fakeApi((c) => {
      if (c.url.endsWith('/presets?page_no=1&per_page=100')) return jsonRes(fixture('list-presets'));
      const m = fixture('get-meeting') as { data: { status: string } };
      m.data.status = 'INACTIVE';
      return jsonRes(m);
    });
    assert.equal(find((await diag(baseEnv(), { fetch: inactive.fetch })).body, 'Reunión')!.estado, 'falla');
    const notFound = fakeApi((c) => (c.url.includes('/presets') ? jsonRes(fixture('list-presets')) : jsonRes({ success: false }, 404)));
    const row = find((await diag(baseEnv(), { fetch: notFound.fetch })).body, 'Reunión')!;
    assert.equal(row.estado, 'falla');
    assert.match(row.detalle, /no corresponde/);
  });

  it('mode: ENSAYO is red on a published origin, warning on localhost', async () => {
    const { body } = await diag(baseEnv({ MOCK_RTK: 'true' }));
    assert.equal(find(body, 'Modo')!.estado, 'falla');
    assert.equal(body.modo, 'ensayo');
    const handler = createHandler({ now: () => NOW_OPEN });
    const env = baseEnv({ MOCK_RTK: 'true' });
    const login = await handler.fetch(new Request('http://localhost:8787/api/anfitrion/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave: SECRETS.HOST_SECRET }) }), env);
    const cookie = login.headers.get('Set-Cookie')!.split(';')[0]!;
    const local = (await (await handler.fetch(new Request('http://localhost:8787/api/anfitrion/diagnostico', { headers: { Cookie: cookie } }), env)).json()) as DiagnosticsResponse;
    assert.equal(find(local, 'Modo')!.estado, 'aviso');
    assert.equal(local.enlaceInvitacion, `http://localhost:8787/?c=${SECRETS.INVITE_CODE}`);
  });

  it('window closed before opening is a warning with Lima time', async () => {
    const { body } = await diag(baseEnv(), { now: OPENS_MS - 60_000 });
    const row = find(body, 'Ventana horaria')!;
    assert.equal(row.estado, 'aviso');
    assert.match(row.detalle, /se abre el sábado 21 de noviembre a las 8:00 a\. m\./);
  });
});

describe('create meeting', () => {
  it('only offered and allowed when RTK_MEETING_ID is empty', async () => {
    const env = baseEnv({ RTK_MEETING_ID: '' });
    const { body } = await diag(env);
    assert.equal(body.puedeCrearReunion, true);
    const { handler, calls } = makeHandler();
    const cookie = await hostCookie(handler, env);
    const res = await handler.fetch(req('/api/anfitrion/crear-reunion', { body: {}, cookie }), env);
    assert.equal(res.status, 200);
    const created = await readJson(res);
    assert.equal(created.id, 'bbb0c0de-0000-4000-8000-00000000new1');
    assert.match(String(created.queHacer), /RTK_MEETING_ID/);
    assert.deepEqual(calls.at(-1)!.body, { title: 'Promoción 81 · Reunión virtual' });
  });

  it('with RTK_MEETING_ID set → 409 and no API call', async () => {
    const env = baseEnv();
    const { handler, calls } = makeHandler();
    const cookie = await hostCookie(handler, env);
    const res = await handler.fetch(req('/api/anfitrion/crear-reunion', { body: {}, cookie }), env);
    assert.equal(res.status, 409);
    assert.equal(calls.length, 0);
    assert.equal((await diag(env)).body.puedeCrearReunion, false);
  });

  it('mock mode returns a simulated id', async () => {
    const env = baseEnv({ RTK_MEETING_ID: '', MOCK_RTK: 'true' });
    const { handler } = makeHandler();
    const cookie = await hostCookie(handler, env);
    const res = await handler.fetch(req('/api/anfitrion/crear-reunion', { body: {}, cookie }), env);
    assert.match(String((await readJson(res)).id), /^mock-meeting-/);
  });
});

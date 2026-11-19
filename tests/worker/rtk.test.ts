import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRtkClient, RtkError, RTK_TIMEOUT_MS, RTK_RETRY_DELAY_MS, type RtkSettings } from '../../src/worker/rtk.ts';
import { readConfig } from '../../src/worker/config.ts';
import { fakeApi, jsonRes, fixture, baseEnv, SECRETS, CLOSES } from './helpers.ts';

const SETTINGS: RtkSettings = { mock: false, cfApiToken: SECRETS.CF_API_TOKEN, accountId: 'acc123', appId: 'app456', meetingId: 'mtg789' };
const BASE = 'https://api.cloudflare.com/client/v4/accounts/acc123/realtime/kit/app456';
const noSleep = { sleep: async () => undefined, log: () => undefined };

function expectHeaders(h: Record<string, string>) {
  assert.equal(h.authorization, `Bearer ${SECRETS.CF_API_TOKEN}`);
  assert.equal(h['content-type'], 'application/json');
}

describe('RealtimeKit client: documented routes, headers and bodies', () => {
  it('addParticipant → POST /meetings/{id}/participants and returns data.token', async () => {
    const api = fakeApi();
    const rtk = createRtkClient(SETTINGS, { fetch: api.fetch, ...noSleep });
    const r = await rtk.addParticipant({ name: 'Ana · Lima', presetName: 'group_call_participant', customParticipantId: 'guest-1', expiresOn: new Date(CLOSES).toISOString() });
    assert.equal(r.authToken, (fixture('add-participant') as { data: { token: string } }).data.token);
    assert.equal(api.calls.length, 1);
    const c = api.calls[0]!;
    assert.equal(c.method, 'POST');
    assert.equal(c.url, `${BASE}/meetings/mtg789/participants`);
    expectHeaders(c.headers);
    assert.deepEqual(c.body, { name: 'Ana · Lima', preset_name: 'group_call_participant', custom_participant_id: 'guest-1', expires_on: '2026-11-22T11:00:00.000Z' });
  });

  it('getMeeting → GET /meetings/{id}', async () => {
    const api = fakeApi();
    const m = await createRtkClient(SETTINGS, { fetch: api.fetch, ...noSleep }).getMeeting();
    assert.equal(api.calls[0]!.url, `${BASE}/meetings/mtg789`);
    assert.equal(api.calls[0]!.method, 'GET');
    expectHeaders(api.calls[0]!.headers);
    assert.equal(m.status, 'ACTIVE');
    assert.equal(m.title, 'Promoción 81 · Reunión virtual');
  });

  it('createMeeting → POST /meetings with the fixed title', async () => {
    const api = fakeApi();
    const r = await createRtkClient({ ...SETTINGS, meetingId: '' }, { fetch: api.fetch, ...noSleep }).createMeeting();
    assert.equal(api.calls[0]!.url, `${BASE}/meetings`);
    assert.equal(api.calls[0]!.method, 'POST');
    assert.deepEqual(api.calls[0]!.body, { title: 'Promoción 81 · Reunión virtual' });
    assert.equal(r.id, 'bbb0c0de-0000-4000-8000-00000000new1');
  });

  it('listPresets → GET /presets and returns names', async () => {
    const api = fakeApi();
    const names = await createRtkClient(SETTINGS, { fetch: api.fetch, ...noSleep }).listPresets();
    assert.equal(new URL(api.calls[0]!.url).pathname, '/client/v4/accounts/acc123/realtime/kit/app456/presets');
    assert.deepEqual(names, ['group_call_host', 'group_call_participant', 'webinar_presenter', 'webinar_viewer']);
  });

  it('identifiers are URL-encoded', async () => {
    const api = fakeApi();
    await createRtkClient({ ...SETTINGS, meetingId: 'a/b?c' }, { fetch: api.fetch, ...noSleep }).getMeeting();
    assert.ok(api.calls[0]!.url.endsWith('/meetings/a%2Fb%3Fc'));
  });
});

describe('RealtimeKit client: retries, timeout and errors', () => {
  it('retries once after 1 s on 5xx', async () => {
    let n = 0;
    const api = fakeApi(() => (++n === 1 ? jsonRes({ success: false }, 503) : jsonRes(fixture('get-meeting'))));
    const sleeps: number[] = [];
    const rtk = createRtkClient(SETTINGS, { fetch: api.fetch, sleep: async (ms) => { sleeps.push(ms); }, log: () => undefined });
    await rtk.getMeeting();
    assert.equal(api.calls.length, 2);
    assert.deepEqual(sleeps, [RTK_RETRY_DELAY_MS]);
    assert.equal(RTK_RETRY_DELAY_MS, 1000);
  });

  it('retries once on a network error, then fails with a Spanish message', async () => {
    const api = fakeApi(() => { throw new TypeError('fetch failed'); });
    const rtk = createRtkClient(SETTINGS, { fetch: api.fetch, ...noSleep });
    await assert.rejects(rtk.getMeeting(), (e: unknown) => e instanceof RtkError && e.kind === 'network' && /No se pudo conectar/.test(e.messageEs));
    assert.equal(api.calls.length, 2);
  });

  it('never retries a 4xx', async () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      const api = fakeApi(() => jsonRes(fixture('error-401'), status));
      const rtk = createRtkClient(SETTINGS, { fetch: api.fetch, ...noSleep });
      await assert.rejects(rtk.addParticipant({ name: 'x y', presetName: 'p', customParticipantId: 'guest-1', expiresOn: 'z' }));
      assert.equal(api.calls.length, 1, `status ${status}`);
    }
  });

  it('translates 401/403 to "token sin permiso"', async () => {
    const api = fakeApi(() => jsonRes(fixture('error-401'), 403));
    await assert.rejects(createRtkClient(SETTINGS, { fetch: api.fetch, ...noSleep }).listPresets(),
      (e: unknown) => e instanceof RtkError && e.kind === 'auth' && /permiso correcto/.test(e.messageEs));
  });

  it('gives up after two 5xx', async () => {
    const api = fakeApi(() => jsonRes({}, 500));
    await assert.rejects(createRtkClient(SETTINGS, { fetch: api.fetch, ...noSleep }).getMeeting(), (e: unknown) => e instanceof RtkError && e.kind === 'server');
    assert.equal(api.calls.length, 2);
  });

  it('rejects responses without data.token', async () => {
    const api = fakeApi(() => jsonRes({ success: true, data: { id: 'x' } }));
    await assert.rejects(createRtkClient(SETTINGS, { fetch: api.fetch, ...noSleep }).addParticipant({ name: 'a b', presetName: 'p', customParticipantId: 'c', expiresOn: 'e' }),
      (e: unknown) => e instanceof RtkError && e.kind === 'invalid_response');
  });

  it('aborts each call after 10 s (real timers mocked) and retries once', async (t) => {
    assert.equal(RTK_TIMEOUT_MS, 10_000);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const signals: AbortSignal[] = [];
    const hanging = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init!.signal!);
      return new Promise<Response>((_res, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('aborted'))));
    }) as typeof fetch;
    const sleeps: number[] = [];
    const rtk = createRtkClient(SETTINGS, { fetch: hanging, sleep: async (ms) => { sleeps.push(ms); }, log: () => undefined });
    const p = rtk.getMeeting();
    const settled = p.then(() => 'ok', (e) => e);
    await Promise.resolve();
    t.mock.timers.tick(9_999);
    await Promise.resolve();
    assert.equal(signals[0]!.aborted, false, 'must not abort before 10 s');
    t.mock.timers.tick(1);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.equal(signals[0]!.aborted, true, 'must abort at 10 s');
    // second attempt
    for (let i = 0; i < 10 && signals.length < 2; i++) await new Promise((r) => setImmediate(r));
    assert.equal(signals.length, 2);
    t.mock.timers.tick(10_000);
    const err = await settled;
    assert.ok(err instanceof RtkError && err.kind === 'timeout', String(err));
    assert.match((err as RtkError).messageEs, /10 segundos/);
    assert.deepEqual(sleeps, [1000]);
  });

  it('falls back to no expires_on only if Cloudflare explicitly rejects that field (D-002)', async () => {
    const bodies: unknown[] = [];
    const api = fakeApi((c) => {
      bodies.push(c.body);
      return bodies.length === 1
        ? jsonRes({ success: false, errors: [{ message: '"expires_on" is not allowed' }] }, 400)
        : jsonRes(fixture('add-participant'));
    });
    const r = await createRtkClient(SETTINGS, { fetch: api.fetch, ...noSleep }).addParticipant({ name: 'a b', presetName: 'group_call_participant', customParticipantId: 'guest-1', expiresOn: '2026-11-22T11:00:00.000Z' });
    assert.ok(r.authToken);
    assert.equal(bodies.length, 2);
    assert.ok('expires_on' in (bodies[0] as object));
    assert.ok(!('expires_on' in (bodies[1] as object)));
    assert.equal((bodies[1] as { preset_name: string }).preset_name, 'group_call_participant');
  });

  it('logs never include the token', async () => {
    const lines: string[] = [];
    const api = fakeApi(() => jsonRes({ token_echo: SECRETS.CF_API_TOKEN }, 500));
    await assert.rejects(createRtkClient(SETTINGS, { fetch: api.fetch, sleep: async () => undefined, log: (m) => lines.push(m) }).getMeeting());
    assert.ok(lines.length > 0);
    assert.ok(!lines.join('\n').includes(SECRETS.CF_API_TOKEN));
  });
});

describe('mock mode', () => {
  it('never calls the network', async () => {
    const spy = mock.fn(fetch);
    const rtk = createRtkClient({ ...SETTINGS, mock: true }, { fetch: spy as typeof fetch });
    const { authToken } = await rtk.addParticipant({ name: 'a b', presetName: 'p', customParticipantId: 'c', expiresOn: 'e' });
    assert.match(authToken, /^mock-[0-9a-f-]{36}$/);
    await rtk.listPresets();
    await rtk.getMeeting();
    assert.match((await rtk.createMeeting()).id, /^mock-meeting-/);
    assert.equal(spy.mock.callCount(), 0);
    assert.equal(rtk.mode, 'ensayo');
  });

  it('with MOCK_RTK other than "true" the real API is always called', async () => {
    for (const v of ['false', '', 'True1', 'yes', undefined]) {
      const api = fakeApi();
      const c = readConfig(baseEnv({ MOCK_RTK: v }));
      const rtk = createRtkClient({ mock: c.mock, cfApiToken: c.cfApiToken, accountId: c.accountId, appId: c.appId, meetingId: c.meetingId }, { fetch: api.fetch, ...noSleep });
      await rtk.addParticipant({ name: 'a b', presetName: 'p', customParticipantId: 'c', expiresOn: 'e' });
      assert.equal(api.calls.length, 1, `MOCK_RTK=${String(v)}`);
      assert.equal(rtk.mode, 'real');
    }
  });
});

import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  safeEqual, createHostToken, verifyHostToken, hostCookieHeader, clearHostCookieHeader, readCookie,
} from '../../src/worker/security.ts';
import { HOST_COOKIE_NAME } from '../../src/shared/contracts.ts';
import { SECRETS, CLOSES_MS, NOW_OPEN, baseEnv, makeHandler, req, GOOD_GUEST } from './helpers.ts';

describe('safeEqual (constant time over SHA-256)', () => {
  afterEach(() => mock.restoreAll());

  it('accepts equal strings and rejects different ones', async () => {
    assert.equal(await safeEqual('abcdef', 'abcdef'), true);
    assert.equal(await safeEqual('abcdef', 'abcdeg'), false);
    assert.equal(await safeEqual('', ''), true);
    assert.equal(await safeEqual('', 'x'), false);
  });

  it('does not exit early on different lengths: always hashes both sides', async () => {
    const spy = mock.method(crypto.subtle, 'digest');
    assert.equal(await safeEqual('a', 'a-much-longer-value-than-the-other'), false);
    assert.equal(spy.mock.callCount(), 2);
    for (const call of spy.mock.calls) assert.equal(call.arguments[0], 'SHA-256');
  });

  it('is used on the invite path (wrong code of a different length still hashes both)', async () => {
    const { handler } = makeHandler();
    const spy = mock.method(crypto.subtle, 'digest');
    const res = await handler.fetch(req('/api/entrar', { body: { ...GOOD_GUEST, codigo: 'x' } }), baseEnv());
    assert.equal(res.status, 403);
    assert.ok(spy.mock.callCount() >= 2, 'invite comparison must hash both values');
  });

  it('is used on the host secret path', async () => {
    const { handler } = makeHandler();
    const spy = mock.method(crypto.subtle, 'digest');
    const res = await handler.fetch(req('/api/anfitrion/entrar', { body: { clave: 'short' } }), baseEnv());
    assert.equal(res.status, 403);
    assert.ok(spy.mock.callCount() >= 2, 'host secret comparison must hash both values');
  });
});

describe('host cookie (HMAC-SHA-256)', () => {
  it('round-trips and has the v1.{exp}.{sig} shape', async () => {
    const token = await createHostToken(CLOSES_MS, SECRETS.HOST_SECRET);
    assert.match(token, /^v1\.\d+\.[A-Za-z0-9_-]{43}$/);
    assert.equal(await verifyHostToken(token, SECRETS.HOST_SECRET, NOW_OPEN, CLOSES_MS), true);
  });

  it('rejects an altered signature', async () => {
    const token = await createHostToken(CLOSES_MS, SECRETS.HOST_SECRET);
    const last = token.at(-1) === 'A' ? 'B' : 'A';
    assert.equal(await verifyHostToken(token.slice(0, -1) + last, SECRETS.HOST_SECRET, NOW_OPEN, CLOSES_MS), false);
  });

  it('rejects an altered expiry (signature no longer matches)', async () => {
    const token = await createHostToken(CLOSES_MS, SECRETS.HOST_SECRET);
    const [, exp, sig] = token.split('.');
    const forged = `v1.${Number(exp) - 10}.${sig}`;
    assert.equal(await verifyHostToken(forged, SECRETS.HOST_SECRET, NOW_OPEN, CLOSES_MS), false);
  });

  it('rejects an expired cookie', async () => {
    const token = await createHostToken(NOW_OPEN - 1000, SECRETS.HOST_SECRET);
    assert.equal(await verifyHostToken(token, SECRETS.HOST_SECRET, NOW_OPEN, CLOSES_MS), false);
  });

  it('rejects a cookie signed with another key (HOST_SECRET changed)', async () => {
    const token = await createHostToken(CLOSES_MS, 'otra-clave-distinta-123');
    assert.equal(await verifyHostToken(token, SECRETS.HOST_SECRET, NOW_OPEN, CLOSES_MS), false);
  });

  it('rejects a cookie that outlives the current EVENT_CLOSES_AT', async () => {
    const token = await createHostToken(CLOSES_MS + 3_600_000, SECRETS.HOST_SECRET);
    assert.equal(await verifyHostToken(token, SECRETS.HOST_SECRET, NOW_OPEN, CLOSES_MS), false);
  });

  it('rejects malformed values', async () => {
    for (const v of [null, '', 'v1', 'v2.123.abc', 'v1.abc.def', 'v1.1.' + 'x'.repeat(300), 'v1.99999999999.' + 'A'.repeat(43)]) {
      assert.equal(await verifyHostToken(v, SECRETS.HOST_SECRET, NOW_OPEN, CLOSES_MS), false, String(v));
    }
  });

  it('Set-Cookie has __Host- prefix, Secure, HttpOnly, SameSite=Strict, Path=/ and Expires = close', () => {
    const h = hostCookieHeader('v1.1.x', CLOSES_MS);
    assert.match(h, /^__Host-myzoom_host=v1\.1\.x; /);
    for (const part of ['Path=/', 'HttpOnly', 'SameSite=Strict', 'Secure', `Expires=${new Date(CLOSES_MS).toUTCString()}`]) {
      assert.ok(h.includes(part), part);
    }
    assert.ok(!/Domain=/i.test(h));
    assert.match(clearHostCookieHeader(), /Max-Age=0/);
  });

  it('readCookie finds the right pair', () => {
    const r = new Request('https://x.example/', { headers: { Cookie: 'a=1; __Host-myzoom_host=v1.2.z; b=3' } });
    assert.equal(readCookie(r, HOST_COOKIE_NAME), 'v1.2.z');
    assert.equal(readCookie(r, 'zz'), null);
  });
});

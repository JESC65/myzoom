import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, parseIsoWithOffset, DEFAULT_HOST_DISPLAY_NAME } from '../../src/worker/config.ts';
import { baseEnv } from './helpers.ts';

const keysOf = (env: ReturnType<typeof baseEnv>) => readConfig(env).problems.map((p) => `${p.key}:${p.level}`);

describe('readConfig', () => {
  it('complete configuration has no problems', () => {
    assert.deepEqual(readConfig(baseEnv()).problems, []);
  });

  it('absent and empty mean the same', () => {
    const a = keysOf(baseEnv({ RTK_MEETING_ID: undefined }));
    const b = keysOf(baseEnv({ RTK_MEETING_ID: '' }));
    const c = keysOf(baseEnv({ RTK_MEETING_ID: '   ' }));
    assert.deepEqual(a, ['RTK_MEETING_ID:falla']);
    assert.deepEqual(a, b);
    assert.deepEqual(a, c);
  });

  it('HOST_SECRET must have at least 12 characters', () => {
    assert.deepEqual(keysOf(baseEnv({ HOST_SECRET: '12345678901' })), ['HOST_SECRET:falla']);
    assert.deepEqual(keysOf(baseEnv({ HOST_SECRET: '123456789012' })), []);
  });

  it('INVITE_CODE must have at least 6 characters', () => {
    assert.deepEqual(keysOf(baseEnv({ INVITE_CODE: '12345' })), ['INVITE_CODE:falla']);
    assert.deepEqual(keysOf(baseEnv({ INVITE_CODE: '123456' })), []);
  });

  it('dates need an explicit offset and must be in order', () => {
    assert.equal(parseIsoWithOffset('2026-11-21T08:00:00'), null);
    assert.equal(parseIsoWithOffset('2026-11-21'), null);
    assert.ok(parseIsoWithOffset('2026-11-21T08:00:00-05:00'));
    assert.ok(parseIsoWithOffset('2026-11-21T13:00Z'));
    assert.deepEqual(keysOf(baseEnv({ EVENT_OPENS_AT: '21/11/2026 08:00' })), ['EVENT_OPENS_AT:falla']);
    const inverted = readConfig(baseEnv({ EVENT_OPENS_AT: '2026-11-22T06:00:00-05:00', EVENT_CLOSES_AT: '2026-11-21T08:00:00-05:00' }));
    assert.deepEqual(inverted.problems.map((p) => p.key), ['EVENT_CLOSES_AT']);
    assert.equal(inverted.opensAt, null);
  });

  it('FALLBACK_URL: https only, no credentials; invalid is ignored and reported', () => {
    for (const bad of ['http://meet.example/x', 'javascript:alert(1)', 'https://user:pass@meet.example/', 'meet.example', 'ftp://x']) {
      const c = readConfig(baseEnv({ FALLBACK_URL: bad }));
      assert.equal(c.fallbackUrl, null, bad);
      assert.deepEqual(c.problems.map((p) => p.key), ['FALLBACK_URL'], bad);
    }
    assert.equal(readConfig(baseEnv({ FALLBACK_URL: 'https://meet.example/abc-defg' })).fallbackUrl, 'https://meet.example/abc-defg');
  });

  it('in mock mode Cloudflare keys are only warnings', () => {
    const env = baseEnv({ MOCK_RTK: 'true', CF_API_TOKEN: '', CF_ACCOUNT_ID: '', RTK_APP_ID: '' });
    assert.deepEqual(keysOf(env), ['CF_API_TOKEN:aviso', 'CF_ACCOUNT_ID:aviso', 'RTK_APP_ID:aviso']);
    const real = baseEnv({ CF_API_TOKEN: '' });
    assert.deepEqual(keysOf(real), ['CF_API_TOKEN:falla']);
  });

  it('MOCK_RTK is only on with the exact value "true"', () => {
    for (const v of ['false', '', '1', 'yes', 'TRUE ']) {
      assert.equal(readConfig(baseEnv({ MOCK_RTK: v })).mock, v.trim().toLowerCase() === 'true', v);
    }
    assert.equal(readConfig(baseEnv({ MOCK_RTK: undefined })).mock, false);
  });

  it('same preset for guests and host is a failure', () => {
    assert.deepEqual(keysOf(baseEnv({ PRESET_GUEST: 'group_call_host' })), ['PRESET_GUEST:falla']);
  });

  it('HOST_DISPLAY_NAME defaults', () => {
    assert.equal(readConfig(baseEnv({ HOST_DISPLAY_NAME: '' })).hostDisplayName, DEFAULT_HOST_DISPLAY_NAME);
  });
});

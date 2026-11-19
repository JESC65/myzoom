// Synthetic mock-mode configuration for the e2e harness. Never real values.
// tests/dist/secretos.test.mjs checks these strings never reach dist/.
export const E2E_SECRETS = {
  CF_API_TOKEN: 'e2e-synthetic-cf-token-QW81',
  HOST_SECRET: 'e2e-synthetic-host-secret-QW81',
  INVITE_CODE: 'e2einv81QW',
};

export function defaultEnv() {
  return {
    ...E2E_SECRETS,
    CF_ACCOUNT_ID: 'e2e-account',
    RTK_APP_ID: 'e2e-app',
    RTK_MEETING_ID: 'e2e-meeting',
    PRESET_GUEST: 'group_call_participant',
    PRESET_HOST: 'group_call_host',
    EVENT_OPENS_AT: '2026-01-01T00:00:00-05:00',
    EVENT_CLOSES_AT: '2099-12-31T23:00:00-05:00',
    FALLBACK_URL: '',
    HOST_DISPLAY_NAME: 'Salón · Promoción 81',
    MOCK_RTK: 'true',
  };
}

// Cloudflare RealtimeKit REST client (API v4) with a mock mode (section 4.2).
// Paths and shapes checked against the official `cloudflare` npm SDK 7.3.0 (D-001).
import { MEETING_TITLE } from '../shared/contracts.ts';

export const RTK_TIMEOUT_MS = 10_000;
export const RTK_RETRY_DELAY_MS = 1_000;
export const API_ORIGIN = 'https://api.cloudflare.com';

export type RtkErrorKind = 'auth' | 'not_found' | 'bad_request' | 'rate_limited' | 'server' | 'network' | 'timeout' | 'invalid_response';

const KIND_MESSAGES: Record<RtkErrorKind, string> = {
  auth: 'El token de Cloudflare no tiene el permiso correcto (o no es válido).',
  not_found: 'Cloudflare no encontró la cuenta, la aplicación o la reunión indicadas.',
  bad_request: 'Cloudflare rechazó la petición: revisa los nombres de los presets y los identificadores.',
  rate_limited: 'Cloudflare pidió esperar: demasiadas peticiones seguidas.',
  server: 'Cloudflare tuvo un error interno. Vuelve a intentarlo en unos segundos.',
  network: 'No se pudo conectar con Cloudflare.',
  timeout: 'Cloudflare tardó más de 10 segundos en responder.',
  invalid_response: 'Cloudflare respondió algo inesperado.',
};

export class RtkError extends Error {
  readonly kind: RtkErrorKind;
  readonly status: number | null;
  readonly operation: string;
  readonly messageEs: string;
  constructor(kind: RtkErrorKind, operation: string, status: number | null) {
    super(`RealtimeKit ${operation} failed: ${kind}${status ? ` (${status})` : ''}`);
    this.kind = kind;
    this.status = status;
    this.operation = operation;
    this.messageEs = KIND_MESSAGES[kind];
  }
}

export interface RtkSettings {
  mock: boolean;
  cfApiToken: string;
  accountId: string;
  appId: string;
  meetingId: string;
}

export interface AddParticipantInput {
  name: string;
  presetName: string;
  customParticipantId: string;
  expiresOn: string;
}

export interface MeetingInfo {
  id: string;
  title: string | null;
  status: string | null;
}

export interface RtkDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  retryDelayMs?: number;
  log?: (msg: string) => void;
}

export interface RtkClient {
  readonly mode: 'real' | 'ensayo';
  addParticipant(input: AddParticipantInput): Promise<{ authToken: string }>;
  getMeeting(): Promise<MeetingInfo>;
  createMeeting(): Promise<{ id: string }>;
  listPresets(): Promise<string[]>;
}

/** Presets returned by the mock: Cloudflare's default names (D-001). */
export const MOCK_PRESETS = ['group_call_host', 'group_call_participant', 'webinar_presenter', 'webinar_viewer'];

export function createRtkClient(settings: RtkSettings, deps: RtkDeps = {}): RtkClient {
  if (settings.mock) return createMockClient(settings);
  return createRealClient(settings, deps);
}

function createMockClient(settings: RtkSettings): RtkClient {
  // Mock mode never touches the network (section 4.8).
  return {
    mode: 'ensayo',
    async addParticipant() {
      return { authToken: `mock-${crypto.randomUUID()}` };
    },
    async getMeeting() {
      if (!settings.meetingId) throw new RtkError('not_found', 'getMeeting', 404);
      return { id: settings.meetingId, title: MEETING_TITLE, status: 'ACTIVE' };
    },
    async createMeeting() {
      return { id: `mock-meeting-${crypto.randomUUID()}` };
    },
    async listPresets() {
      return [...MOCK_PRESETS];
    },
  };
}

function kindForStatus(status: number): RtkErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'bad_request';
}

function createRealClient(settings: RtkSettings, deps: RtkDeps): RtkClient {
  const doFetch = deps.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = deps.timeoutMs ?? RTK_TIMEOUT_MS;
  const retryDelayMs = deps.retryDelayMs ?? RTK_RETRY_DELAY_MS;
  // Never log the token, the request body or the full response body (section 4.2).
  const log = deps.log ?? ((msg: string) => console.error(msg));
  const base = `${API_ORIGIN}/client/v4/accounts/${encodeURIComponent(settings.accountId)}/realtime/kit/${encodeURIComponent(settings.appId)}`;

  async function once(operation: string, method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${settings.cfApiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let json: unknown = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      return { status: res.status, json, text };
    } catch {
      throw new RtkError(controller.signal.aborted ? 'timeout' : 'network', operation, null);
    } finally {
      clearTimeout(timer);
    }
  }

  /** One retry after 1 s on network error, timeout or 5xx. Never on 4xx. */
  async function call(operation: string, method: string, path: string, body?: unknown): Promise<{ json: unknown; text: string }> {
    let lastError: RtkError | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const r = await once(operation, method, path, body);
        if (r.status >= 200 && r.status < 300) return r;
        const err = new RtkError(kindForStatus(r.status), operation, r.status);
        (err as RtkError & { bodyText?: string }).bodyText = r.text.slice(0, 500);
        if (r.status < 500) {
          log(`[rtk] ${operation} -> HTTP ${r.status} (${err.kind})`);
          throw err;
        }
        lastError = err;
      } catch (e) {
        if (!(e instanceof RtkError)) throw e;
        if (e.status !== null && e.status < 500) throw e;
        lastError = e;
      }
      log(`[rtk] ${operation} attempt ${attempt} failed: ${lastError.kind}${lastError.status ? ` HTTP ${lastError.status}` : ''}`);
      if (attempt === 1) await sleep(retryDelayMs);
    }
    throw lastError ?? new RtkError('network', operation, null);
  }

  function dataOf(json: unknown, operation: string): Record<string, unknown> {
    const data = (json as { data?: unknown } | null)?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RtkError('invalid_response', operation, null);
    return data as Record<string, unknown>;
  }

  const meetingPath = () => `/meetings/${encodeURIComponent(settings.meetingId)}`;

  return {
    mode: 'real',
    async addParticipant(input) {
      const body = {
        name: input.name,
        preset_name: input.presetName,
        custom_participant_id: input.customParticipantId,
        expires_on: input.expiresOn,
      };
      let r: { json: unknown; text: string };
      try {
        r = await call('addParticipant', 'POST', `${meetingPath()}/participants`, body);
      } catch (e) {
        // `expires_on` comes from the FAQ but is not in the SDK types (D-002).
        // If Cloudflare rejects that field explicitly, issue the token without it.
        const bodyText = (e as { bodyText?: string }).bodyText ?? '';
        if (e instanceof RtkError && e.kind === 'bad_request' && /expires_on/i.test(bodyText)) {
          log('[rtk] addParticipant: expires_on rejected, retrying without it (D-002)');
          const { expires_on: _ignored, ...withoutExpiry } = body;
          void _ignored;
          r = await call('addParticipant', 'POST', `${meetingPath()}/participants`, withoutExpiry);
        } else {
          throw e;
        }
      }
      const data = dataOf(r.json, 'addParticipant');
      const token = data.token;
      if (typeof token !== 'string' || token.length === 0) throw new RtkError('invalid_response', 'addParticipant', null);
      return { authToken: token };
    },
    async getMeeting() {
      const r = await call('getMeeting', 'GET', meetingPath());
      const data = dataOf(r.json, 'getMeeting');
      return {
        id: typeof data.id === 'string' ? data.id : settings.meetingId,
        title: typeof data.title === 'string' ? data.title : null,
        status: typeof data.status === 'string' ? data.status : null,
      };
    },
    async createMeeting() {
      const r = await call('createMeeting', 'POST', '/meetings', { title: MEETING_TITLE });
      const data = dataOf(r.json, 'createMeeting');
      if (typeof data.id !== 'string' || !data.id) throw new RtkError('invalid_response', 'createMeeting', null);
      return { id: data.id };
    },
    async listPresets() {
      const r = await call('listPresets', 'GET', '/presets?page_no=1&per_page=100');
      const list = (r.json as { data?: unknown } | null)?.data;
      if (!Array.isArray(list)) throw new RtkError('invalid_response', 'listPresets', null);
      return list
        .map((p) => (p && typeof p === 'object' ? (p as { name?: unknown }).name : undefined))
        .filter((n): n is string => typeof n === 'string');
    },
  };
}

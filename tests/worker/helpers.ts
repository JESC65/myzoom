// Shared helpers for the Worker tests (node --test, no external packages).
import { readFileSync } from 'node:fs';
import { createHandler, type Env } from '../../src/worker/index.ts';

export const ORIGIN = 'https://myzoom.example';

// Synthetic values (never real). tests/dist checks they never reach dist/.
export const SECRETS = {
  CF_API_TOKEN: 'synthetic-cf-token-ZQX81',
  HOST_SECRET: 'synthetic-host-secret-ZQX81',
  INVITE_CODE: 'synthinv81',
} as const;

export const OPENS = '2026-11-21T08:00:00-05:00';
export const CLOSES = '2026-11-22T06:00:00-05:00';
export const OPENS_MS = Date.parse(OPENS);
export const CLOSES_MS = Date.parse(CLOSES);
export const NOW_OPEN = Date.parse('2026-11-21T12:00:00-05:00');

export function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    ...SECRETS,
    CF_ACCOUNT_ID: 'acc123',
    RTK_APP_ID: 'app456',
    RTK_MEETING_ID: 'mtg789',
    PRESET_GUEST: 'group_call_participant',
    PRESET_HOST: 'group_call_host',
    EVENT_OPENS_AT: OPENS,
    EVENT_CLOSES_AT: CLOSES,
    FALLBACK_URL: '',
    HOST_DISPLAY_NAME: 'Salón · Promoción 81',
    MOCK_RTK: 'false',
    ASSETS: assetsStub(),
    ...overrides,
  };
}

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
}

export function assetsStub() {
  return {
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname;
      if (path.startsWith('/assets/')) return new Response('console.log(1)', { headers: { 'Content-Type': 'text/javascript' } });
      return new Response('<!doctype html><title>MyZoom</title><div id="root"></div>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    },
  };
}

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

type Responder = (call: RecordedCall) => Response | Promise<Response>;

/** Intercepted fetch that answers like the documented API and records each call. */
export function fakeApi(responder?: Responder) {
  const calls: RecordedCall[] = [];
  const defaultResponder: Responder = (call) => {
    const u = new URL(call.url);
    if (call.method === 'POST' && u.pathname.endsWith('/participants')) return jsonRes(fixture('add-participant'));
    if (call.method === 'GET' && u.pathname.endsWith('/presets')) return jsonRes(fixture('list-presets'));
    if (call.method === 'POST' && u.pathname.endsWith('/meetings')) return jsonRes(fixture('create-meeting'), 201);
    if (call.method === 'GET' && /\/meetings\/[^/]+$/.test(u.pathname)) return jsonRes(fixture('get-meeting'));
    return jsonRes({ success: false }, 404);
  };
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => { headers[k] = v; });
    const call: RecordedCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return (responder ?? defaultResponder)(call);
  };
  return { calls, fetch: fetchImpl as typeof fetch };
}

export function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export function makeHandler(opts: { now?: number; fetch?: typeof fetch } = {}) {
  const api = opts.fetch ? null : fakeApi();
  const handler = createHandler({
    now: () => opts.now ?? NOW_OPEN,
    rtk: { fetch: opts.fetch ?? api!.fetch, sleep: async () => undefined },
  });
  return { handler, calls: api?.calls ?? [] };
}

export interface ReqOptions {
  method?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  cookie?: string;
  origin?: string | null;
}

export function req(path: string, opts: ReqOptions = {}): Request {
  const method = opts.method ?? (opts.body !== undefined || opts.rawBody !== undefined ? 'POST' : 'GET');
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined || opts.rawBody !== undefined) headers['Content-Type'] ??= 'application/json';
  if (opts.origin !== null && method === 'POST') headers.Origin ??= opts.origin ?? ORIGIN;
  if (opts.cookie) headers.Cookie = opts.cookie;
  const body = opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined);
  return new Request(`${ORIGIN}${path}`, { method, headers, body });
}

export async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

export const GOOD_GUEST = { nombre: 'Carlos Prueba', ciudad: 'Toronto', codigo: SECRETS.INVITE_CODE };

/** Logs in as host and returns the "name=value" cookie pair. */
export async function hostCookie(handler: ReturnType<typeof createHandler>, env: Env): Promise<string> {
  const res = await handler.fetch(req('/api/anfitrion/entrar', { body: { clave: SECRETS.HOST_SECRET } }), env);
  const set = res.headers.get('Set-Cookie');
  if (res.status !== 200 || !set) throw new Error(`host login failed: ${res.status}`);
  return set.split(';')[0] as string;
}

/** Captures console.error / console.log output while fn runs. */
export async function captureLogs(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const origError = console.error;
  const origLog = console.log;
  const origWarn = console.warn;
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  console.warn = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  try {
    await fn();
  } finally {
    console.error = origError;
    console.log = origLog;
    console.warn = origWarn;
  }
  return lines.join('\n');
}

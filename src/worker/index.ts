// MyZoom Worker: API (/api/*) and the compiled app (Workers Static Assets) on one origin.
import { API, HOST_COOKIE_NAME, type CreateMeetingResponse, type JoinResponse, type StatusResponse } from '../shared/contracts.ts';
import { MSG } from '../shared/messages.ts';
import { displayNameFor, validateGuestInput } from '../shared/validate.ts';
import { credentialKeys, hasBlocking, readConfig, type Config, type Env } from './config.ts';
import { buildDiagnostics } from './diagnostics.ts';
import { json, jsonError, readJsonBody } from './http.ts';
import { createRtkClient, RtkError, type RtkClient, type RtkDeps } from './rtk.ts';
import {
  clearHostCookieHeader, createHostToken, hostCookieHeader, readCookie, safeEqual, verifyHostToken, withSecurityHeaders,
} from './security.ts';
import { eventWindow } from './time.ts';

export type { Env } from './config.ts';

export interface HandlerDeps {
  now?: () => number;
  rtk?: RtkDeps;
}

/** Fallback lifetime of the host cookie when EVENT_CLOSES_AT is missing or already past. */
const HOST_COOKIE_FALLBACK_MS = 6 * 60 * 60 * 1000;

function hostCookieExpiry(config: Config, now: number): number {
  return config.closesAt !== null && config.closesAt > now ? config.closesAt : now + HOST_COOKIE_FALLBACK_MS;
}

async function isHost(request: Request, config: Config, now: number): Promise<boolean> {
  if (hasBlocking(config, ['HOST_SECRET'])) return false;
  const value = readCookie(request, HOST_COOKIE_NAME);
  const max = config.closesAt !== null && config.closesAt > now ? config.closesAt : null;
  return verifyHostToken(value, config.hostSecret, now, max);
}

function windowError(config: Config, now: number): Response | null {
  const w = eventWindow(now, config.opensAt, config.closesAt);
  if (w.state === 'before') return jsonError(403, MSG.notOpenYet(w.opensLima));
  if (w.state === 'after') return jsonError(403, MSG.alreadyClosed);
  if (w.state === 'unknown') return jsonError(503, MSG.notReady);
  return null;
}

function rtkFailure(e: unknown, operation: string): Response {
  const kind = e instanceof RtkError ? e.kind : 'unknown';
  console.error(`[api] ${operation} failed: ${kind}`);
  return jsonError(502, MSG.serviceError);
}

function rtkFor(config: Config, deps: HandlerDeps): RtkClient {
  return createRtkClient(
    { mock: config.mock, cfApiToken: config.cfApiToken, accountId: config.accountId, appId: config.appId, meetingId: config.meetingId },
    deps.rtk,
  );
}

async function guestJoin(request: Request, url: URL, config: Config, now: number, deps: HandlerDeps): Promise<Response> {
  const parsed = await readJsonBody(request, url);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  if (config.fallbackUrl) return jsonError(409, MSG.fallbackActive, { respaldo: config.fallbackUrl });

  const blocking = [...credentialKeys('PRESET_GUEST'), 'INVITE_CODE' as const];
  if (hasBlocking(config, blocking)) {
    console.error(`[api] guest join blocked by config: ${config.problems.filter((p) => p.level === 'falla').map((p) => p.key).join(',')}`);
    return jsonError(503, MSG.notReady);
  }

  const windowResponse = windowError(config, now);
  if (windowResponse) return windowResponse;

  const codigo = typeof body.codigo === 'string' ? body.codigo : '';
  if (!(await safeEqual(codigo, config.inviteCode))) return jsonError(403, MSG.invalidInvite);

  const input = validateGuestInput(body.nombre, body.ciudad);
  if (!input.ok) return jsonError(400, input.campo === 'nombre' ? MSG.nameInvalid : MSG.cityInvalid, { campo: input.campo });

  // Non-negotiable: the preset is always PRESET_GUEST. Any preset/role field in the body is ignored.
  const nombreVisible = displayNameFor(input.nombre, input.ciudad);
  try {
    const { authToken } = await rtkFor(config, deps).addParticipant({
      name: nombreVisible,
      presetName: config.presetGuest,
      customParticipantId: `guest-${crypto.randomUUID()}`,
      expiresOn: config.closesAtIso as string,
    });
    const res: JoinResponse = { authToken, nombreVisible, modo: config.mock ? 'ensayo' : 'real' };
    // Mock only: lets the acceptance test see which preset the simulated API received (D-008).
    return json(res, 200, config.mock ? { 'X-MyZoom-Mock-Preset': config.presetGuest } : {});
  } catch (e) {
    return rtkFailure(e, 'guest join');
  }
}

async function hostLogin(request: Request, url: URL, config: Config, now: number): Promise<Response> {
  const parsed = await readJsonBody(request, url);
  if (!parsed.ok) return parsed.response;
  if (hasBlocking(config, ['HOST_SECRET'])) return jsonError(503, MSG.hostNotConfigured);
  const clave = typeof parsed.body.clave === 'string' ? parsed.body.clave : '';
  if (!(await safeEqual(clave, config.hostSecret))) return jsonError(403, MSG.hostWrongSecret);
  const expires = hostCookieExpiry(config, now);
  const token = await createHostToken(expires, config.hostSecret);
  return json({ ok: true }, 200, { 'Set-Cookie': hostCookieHeader(token, expires) });
}

async function hostCredential(request: Request, url: URL, config: Config, now: number, deps: HandlerDeps): Promise<Response> {
  if (!(await isHost(request, config, now))) return jsonError(401, MSG.hostUnauthorized);
  const parsed = await readJsonBody(request, url);
  if (!parsed.ok) return parsed.response;
  const keys = credentialKeys('PRESET_HOST');
  if (hasBlocking(config, keys)) {
    const missing = config.problems.filter((p) => p.level === 'falla' && keys.includes(p.key)).map((p) => p.key);
    return jsonError(503, `Falta configurar: ${[...new Set(missing)].join(', ')}. Abre la pestaña Diagnóstico.`);
  }
  const windowResponse = windowError(config, now);
  if (windowResponse) return windowResponse;
  try {
    const { authToken } = await rtkFor(config, deps).addParticipant({
      name: config.hostDisplayName,
      presetName: config.presetHost,
      customParticipantId: `host-${crypto.randomUUID()}`,
      expiresOn: config.closesAtIso as string,
    });
    const res: JoinResponse = { authToken, nombreVisible: config.hostDisplayName, modo: config.mock ? 'ensayo' : 'real' };
    return json(res, 200, config.mock ? { 'X-MyZoom-Mock-Preset': config.presetHost } : {});
  } catch (e) {
    return rtkFailure(e, 'host credential');
  }
}

async function createMeeting(request: Request, url: URL, config: Config, now: number, deps: HandlerDeps): Promise<Response> {
  if (!(await isHost(request, config, now))) return jsonError(401, MSG.hostUnauthorized);
  const parsed = await readJsonBody(request, url);
  if (!parsed.ok) return parsed.response;
  if (config.meetingId) return jsonError(409, MSG.meetingAlreadySet);
  if (!config.mock && (!config.cfApiToken || !config.accountId || !config.appId))
    return jsonError(503, 'Faltan CF_API_TOKEN, CF_ACCOUNT_ID o RTK_APP_ID: complétalos antes de crear la reunión.');
  try {
    const { id } = await rtkFor(config, deps).createMeeting();
    const res: CreateMeetingResponse = { id, queHacer: MSG.meetingCreatedNext };
    return json(res);
  } catch (e) {
    const err = e instanceof RtkError ? e : null;
    console.error(`[api] create meeting failed: ${err?.kind ?? 'unknown'}`);
    return jsonError(502, err?.messageEs ?? MSG.serviceError);
  }
}

async function handleApi(request: Request, url: URL, env: Env, deps: HandlerDeps): Promise<Response> {
  const config = readConfig(env);
  const now = (deps.now ?? Date.now)();
  const route = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;

  switch (route) {
    case `GET ${API.status}`: {
      const w = eventWindow(now, config.opensAt, config.closesAt);
      const res: StatusResponse = {
        abierto: w.state === 'open',
        abreEn: config.opensAtIso,
        cierraEn: config.closesAtIso,
        respaldo: config.fallbackUrl !== null,
        modo: config.mock ? 'ensayo' : 'real',
      };
      return json(res);
    }
    case `POST ${API.guestJoin}`:
      return guestJoin(request, url, config, now, deps);
    case `POST ${API.hostLogin}`:
      return hostLogin(request, url, config, now);
    case `GET ${API.hostSession}`:
      return (await isHost(request, config, now)) ? json({ ok: true }) : jsonError(401, MSG.hostUnauthorized);
    case `POST ${API.hostCredential}`:
      return hostCredential(request, url, config, now, deps);
    case `POST ${API.hostLogout}`: {
      const origin = request.headers.get('Origin');
      if (origin !== null && origin !== url.origin) return jsonError(403, MSG.foreignOrigin);
      return json({ ok: true }, 200, { 'Set-Cookie': clearHostCookieHeader() });
    }
    case `GET ${API.hostDiagnostics}`: {
      if (!(await isHost(request, config, now))) return jsonError(401, MSG.hostUnauthorized);
      return json(await buildDiagnostics(config, rtkFor(config, deps), url, now));
    }
    case `POST ${API.hostCreateMeeting}`:
      return createMeeting(request, url, config, now, deps);
    default: {
      const known = Object.values(API).includes(url.pathname.replace(/\/+$/, '') as (typeof API)[keyof typeof API]);
      return known ? jsonError(405, MSG.methodNotAllowed) : jsonError(404, MSG.notFound);
    }
  }
}

async function handlePage(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Método no permitido', { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  const isGuestEntry = url.pathname === '/' || url.pathname === '/index.html';
  if (isGuestEntry) {
    const config = readConfig(env);
    if (config.fallbackUrl) {
      // Never forward the invite code or the query string to the fallback room.
      return new Response(null, { status: 302, headers: { Location: config.fallbackUrl, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    }
  }
  if (!env.ASSETS) return new Response('Falta la aplicación compilada (ASSETS).', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  const assetResponse = await env.ASSETS.fetch(request);
  const isHtml = (assetResponse.headers.get('Content-Type') ?? '').includes('text/html');
  return withSecurityHeaders(assetResponse, isHtml);
}

export function createHandler(deps: HandlerDeps = {}) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      try {
        if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await handleApi(request, url, env, deps);
        return await handlePage(request, url, env);
      } catch (e) {
        console.error(`[worker] unexpected error: ${e instanceof Error ? e.name : 'unknown'}`);
        return url.pathname.startsWith('/api') ? jsonError(500, MSG.serviceError) : new Response('Error interno', { status: 500 });
      }
    },
  };
}

export default createHandler();

// Single place where configuration is read and validated (section 4.1).
// Returns a list of problems in Spanish instead of throwing.
import { LIMITS } from '../shared/contracts.ts';
import { validFallbackUrl } from '../shared/validate.ts';

/** Minimal shape of the static assets binding. */
export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS?: AssetsBinding;
  CF_API_TOKEN?: string;
  HOST_SECRET?: string;
  INVITE_CODE?: string;
  CF_ACCOUNT_ID?: string;
  RTK_APP_ID?: string;
  RTK_MEETING_ID?: string;
  PRESET_GUEST?: string;
  PRESET_HOST?: string;
  EVENT_OPENS_AT?: string;
  EVENT_CLOSES_AT?: string;
  FALLBACK_URL?: string;
  HOST_DISPLAY_NAME?: string;
  MOCK_RTK?: string;
}

export const DEFAULT_HOST_DISPLAY_NAME = 'Salón · Promoción 81';

export type ConfigKey = Exclude<keyof Env, 'ASSETS'>;

export interface ConfigProblem {
  key: ConfigKey;
  /** 'falla' blocks something; 'aviso' does not. */
  level: 'falla' | 'aviso';
  detalle: string;
  queHacer: string;
}

export interface Config {
  mock: boolean;
  cfApiToken: string;
  hostSecret: string;
  inviteCode: string;
  accountId: string;
  appId: string;
  meetingId: string;
  presetGuest: string;
  presetHost: string;
  opensAt: number | null;
  closesAt: number | null;
  opensAtIso: string | null;
  closesAtIso: string | null;
  fallbackUrl: string | null;
  fallbackRaw: string;
  hostDisplayName: string;
  problems: ConfigProblem[];
}

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Parses an ISO 8601 date that must carry an explicit offset. */
export function parseIsoWithOffset(value: string): number | null {
  if (!ISO_WITH_OFFSET.test(value)) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

export function readConfig(env: Env): Config {
  const problems: ConfigProblem[] = [];
  const mock = str(env.MOCK_RTK).toLowerCase() === 'true';
  const missing = (key: ConfigKey, queHacer: string, level: 'falla' | 'aviso' = 'falla') =>
    problems.push({ key, level, detalle: `${key} no está definido.`, queHacer });

  const cfApiToken = str(env.CF_API_TOKEN);
  const accountId = str(env.CF_ACCOUNT_ID);
  const appId = str(env.RTK_APP_ID);
  const level = mock ? 'aviso' : 'falla';
  if (!cfApiToken) missing('CF_API_TOKEN', 'Créalo en Cloudflare (My Profile → API Tokens) con el permiso de Realtime y cárgalo como Secret.', level);
  if (!accountId) missing('CF_ACCOUNT_ID', 'Cópialo del panel de Cloudflare (Account ID) y cárgalo como variable de texto.', level);
  if (!appId) missing('RTK_APP_ID', 'Cópialo de la aplicación de RealtimeKit (Realtime → RealtimeKit) y cárgalo como variable de texto.', level);

  const hostSecret = str(env.HOST_SECRET);
  if (!hostSecret) missing('HOST_SECRET', 'Inventa una clave de al menos 12 caracteres y cárgala como Secret.');
  else if (hostSecret.length < LIMITS.hostSecretMin)
    problems.push({ key: 'HOST_SECRET', level: 'falla', detalle: `HOST_SECRET tiene menos de ${LIMITS.hostSecretMin} caracteres.`, queHacer: 'Cámbiala por una clave más larga (12 o más caracteres).' });

  const inviteCode = str(env.INVITE_CODE);
  if (!inviteCode) missing('INVITE_CODE', 'Inventa un código de al menos 6 caracteres y cárgalo como Secret.');
  else if (inviteCode.length < LIMITS.inviteCodeMin)
    problems.push({ key: 'INVITE_CODE', level: 'falla', detalle: `INVITE_CODE tiene menos de ${LIMITS.inviteCodeMin} caracteres.`, queHacer: 'Cámbialo por un código más largo (6 o más caracteres).' });

  const meetingId = str(env.RTK_MEETING_ID);
  if (!meetingId) missing('RTK_MEETING_ID', 'Abre Diagnóstico, pulsa «Crear la reunión» y pega el identificador en Cloudflare.');

  const presetGuest = str(env.PRESET_GUEST);
  const presetHost = str(env.PRESET_HOST);
  if (!presetGuest) missing('PRESET_GUEST', 'Escribe el nombre exacto del preset de invitado (lo ves en Diagnóstico).');
  if (!presetHost) missing('PRESET_HOST', 'Escribe el nombre exacto del preset de anfitrión (lo ves en Diagnóstico).');
  if (presetGuest && presetHost && presetGuest === presetHost)
    problems.push({ key: 'PRESET_GUEST', level: 'falla', detalle: 'PRESET_GUEST y PRESET_HOST son iguales: los invitados tendrían permisos de anfitrión.', queHacer: 'Usa un preset distinto para invitados.' });

  const opensRaw = str(env.EVENT_OPENS_AT);
  const closesRaw = str(env.EVENT_CLOSES_AT);
  let opensAt: number | null = null;
  let closesAt: number | null = null;
  if (!opensRaw) missing('EVENT_OPENS_AT', 'Escribe el inicio, por ejemplo 2026-11-21T08:00:00-05:00.');
  else if ((opensAt = parseIsoWithOffset(opensRaw)) === null)
    problems.push({ key: 'EVENT_OPENS_AT', level: 'falla', detalle: 'EVENT_OPENS_AT no es una fecha válida con desfase horario.', queHacer: 'Usa el formato 2026-11-21T08:00:00-05:00.' });
  if (!closesRaw) missing('EVENT_CLOSES_AT', 'Escribe el cierre, por ejemplo 2026-11-22T06:00:00-05:00.');
  else if ((closesAt = parseIsoWithOffset(closesRaw)) === null)
    problems.push({ key: 'EVENT_CLOSES_AT', level: 'falla', detalle: 'EVENT_CLOSES_AT no es una fecha válida con desfase horario.', queHacer: 'Usa el formato 2026-11-22T06:00:00-05:00.' });
  if (opensAt !== null && closesAt !== null && closesAt <= opensAt) {
    problems.push({ key: 'EVENT_CLOSES_AT', level: 'falla', detalle: 'EVENT_CLOSES_AT es anterior o igual a EVENT_OPENS_AT.', queHacer: 'Corrige las fechas: el cierre debe ser posterior al inicio.' });
    opensAt = null;
    closesAt = null;
  }

  const fallbackRaw = str(env.FALLBACK_URL);
  const fallbackUrl = validFallbackUrl(fallbackRaw);
  if (fallbackRaw && !fallbackUrl)
    problems.push({ key: 'FALLBACK_URL', level: 'falla', detalle: 'FALLBACK_URL no es una dirección https:// válida (o lleva usuario y clave). Se ignora: el respaldo NO está activo.', queHacer: 'Pega el enlace completo de la sala de respaldo, que empiece con https://, o déjala vacía.' });

  const hostDisplayName = str(env.HOST_DISPLAY_NAME) || DEFAULT_HOST_DISPLAY_NAME;

  return {
    mock, cfApiToken, hostSecret, inviteCode, accountId, appId, meetingId, presetGuest, presetHost,
    opensAt, closesAt,
    opensAtIso: opensAt === null ? null : new Date(opensAt).toISOString(),
    closesAtIso: closesAt === null ? null : new Date(closesAt).toISOString(),
    fallbackUrl, fallbackRaw, hostDisplayName, problems,
  };
}

/** True when any listed key has a blocking problem. */
export function hasBlocking(config: Config, keys: ConfigKey[]): boolean {
  return config.problems.some((p) => p.level === 'falla' && keys.includes(p.key));
}


/** Keys a credential needs (guest or host). Cloudflare keys are only 'aviso' in mock mode. */
export function credentialKeys(preset: 'PRESET_GUEST' | 'PRESET_HOST'): ConfigKey[] {
  return ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'RTK_APP_ID', 'RTK_MEETING_ID', preset, 'EVENT_OPENS_AT', 'EVENT_CLOSES_AT'];
}

// Frozen contract between the client and the Worker (see docs/DECISIONES.md D-004).
// Any change requires a DECISIONES entry and updated tests.

export type Mode = 'real' | 'ensayo';
export type Role = 'invitado' | 'anfitrion';

export const LIMITS = {
  nameMin: 2,
  nameMax: 60,
  cityMin: 2,
  cityMax: 50,
  bodyMaxBytes: 2048,
  hostSecretMin: 12,
  inviteCodeMin: 6,
} as const;

export const HOST_COOKIE_NAME = '__Host-myzoom_host';

/** The only polling allowed (section 4.6). */
export const STATUS_POLL_MS = 60_000;

export const MEETING_TITLE = 'Promoción 81 · Reunión virtual';

export const API = {
  status: '/api/estado',
  guestJoin: '/api/entrar',
  hostLogin: '/api/anfitrion/entrar',
  hostSession: '/api/anfitrion/sesion',
  hostCredential: '/api/anfitrion/credencial',
  hostLogout: '/api/anfitrion/salir',
  hostDiagnostics: '/api/anfitrion/diagnostico',
  hostCreateMeeting: '/api/anfitrion/crear-reunion',
} as const;

/** GET /api/estado */
export interface StatusResponse {
  abierto: boolean;
  abreEn: string | null;
  cierraEn: string | null;
  respaldo: boolean;
  modo: Mode;
}

/** POST /api/entrar (extra fields are ignored by the server) */
export interface GuestJoinRequest {
  nombre: string;
  ciudad: string;
  codigo: string;
}

/** POST /api/entrar and POST /api/anfitrion/credencial */
export interface JoinResponse {
  authToken: string;
  nombreVisible: string;
  modo: Mode;
}

/** POST /api/anfitrion/entrar */
export interface HostLoginRequest {
  clave: string;
}

export interface OkResponse {
  ok: true;
}

/** Every error body. `respaldo` only on 409 from /api/entrar; `campo` only on 400. */
export interface ErrorResponse {
  error: string;
  respaldo?: string;
  campo?: 'nombre' | 'ciudad';
}

export type CheckState = 'ok' | 'aviso' | 'falla';

export interface Check {
  nombre: string;
  estado: CheckState;
  detalle: string;
  queHacer: string;
}

/** GET /api/anfitrion/diagnostico */
export interface DiagnosticsResponse {
  modo: Mode;
  checks: Check[];
  puedeCrearReunion: boolean;
  /** Invitation link for WhatsApp; only for the host with a valid cookie. */
  enlaceInvitacion: string | null;
  presetsDisponibles: string[];
  ventana: { abierto: boolean; abreEnLima: string | null; cierraEnLima: string | null };
}

/** POST /api/anfitrion/crear-reunion */
export interface CreateMeetingResponse {
  id: string;
  queHacer: string;
}

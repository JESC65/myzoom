// Host diagnostics (section 4.7): Spanish checks, never secret values.
import type { Check, DiagnosticsResponse } from '../shared/contracts.ts';
import { formatLima } from '../shared/time-format.ts';
import type { Config, ConfigKey } from './config.ts';
import { RtkError, type RtkClient } from './rtk.ts';
import { eventWindow } from './time.ts';
import { isLocalHost } from './security.ts';

const SECRET_KEYS: ConfigKey[] = ['CF_API_TOKEN', 'HOST_SECRET', 'INVITE_CODE'];
const VAR_KEYS: ConfigKey[] = ['CF_ACCOUNT_ID', 'RTK_APP_ID', 'RTK_MEETING_ID', 'PRESET_GUEST', 'PRESET_HOST', 'EVENT_OPENS_AT', 'EVENT_CLOSES_AT', 'FALLBACK_URL', 'HOST_DISPLAY_NAME'];

function configChecks(config: Config): Check[] {
  const checks: Check[] = [];
  for (const key of [...SECRET_KEYS, ...VAR_KEYS]) {
    const problems = config.problems.filter((p) => p.key === key);
    const kind = SECRET_KEYS.includes(key) ? 'Secreto' : 'Variable';
    if (problems.length === 0) {
      let detalle = 'Definido correctamente.';
      if (key === 'FALLBACK_URL') detalle = config.fallbackUrl ? 'Respaldo ACTIVO: los invitados van a la sala de respaldo.' : 'Vacía: sin respaldo activo (normal).';
      if (key === 'HOST_DISPLAY_NAME') detalle = `El salón aparece como «${config.hostDisplayName}».`;
      if (key === 'PRESET_GUEST') detalle = `Preset de invitado: «${config.presetGuest}».`;
      if (key === 'PRESET_HOST') detalle = `Preset de anfitrión: «${config.presetHost}».`;
      if (key === 'EVENT_OPENS_AT' && config.opensAt !== null) detalle = `Abre el ${formatLima(new Date(config.opensAt))}.`;
      if (key === 'EVENT_CLOSES_AT' && config.closesAt !== null) detalle = `Cierra el ${formatLima(new Date(config.closesAt))}.`;
      const estado = key === 'FALLBACK_URL' && config.fallbackUrl ? 'aviso' : 'ok';
      checks.push({ nombre: `${kind} ${key}`, estado, detalle, queHacer: estado === 'aviso' ? 'Para volver a MyZoom, borra FALLBACK_URL en Cloudflare y guarda.' : '' });
    } else {
      for (const p of problems) checks.push({ nombre: `${kind} ${key}`, estado: p.level, detalle: p.detalle, queHacer: p.queHacer });
    }
  }
  return checks;
}

export async function buildDiagnostics(config: Config, rtk: RtkClient, url: URL, now: number): Promise<DiagnosticsResponse> {
  const checks = configChecks(config);

  // Mode
  if (config.mock) {
    const local = isLocalHost(url.hostname);
    checks.push({
      nombre: 'Modo',
      estado: local ? 'aviso' : 'falla',
      detalle: local ? 'ENSAYO (simulado, sin Cloudflare). Correcto en tu computadora.' : 'ENSAYO en un sitio publicado: la sala NO funciona de verdad.',
      queHacer: local ? '' : 'En Cloudflare cambia MOCK_RTK a false (o bórrala) y vuelve a desplegar.',
    });
  } else {
    checks.push({ nombre: 'Modo', estado: 'ok', detalle: 'Real (RealtimeKit de Cloudflare).', queHacer: '' });
  }

  // Cloudflare API + presets
  let presets: string[] = [];
  const canCallApi = config.mock || (config.cfApiToken && config.accountId && config.appId);
  if (!canCallApi) {
    checks.push({ nombre: 'API de Cloudflare', estado: 'falla', detalle: 'No se puede comprobar: faltan CF_API_TOKEN, CF_ACCOUNT_ID o RTK_APP_ID.', queHacer: 'Completa esas tres primero.' });
  } else {
    try {
      presets = await rtk.listPresets();
      checks.push({ nombre: 'API de Cloudflare', estado: 'ok', detalle: config.mock ? 'Simulada: responde.' : 'Responde con el token configurado.', queHacer: '' });
    } catch (e) {
      const err = e instanceof RtkError ? e : null;
      checks.push({
        nombre: 'API de Cloudflare',
        estado: 'falla',
        detalle: err?.kind === 'auth' ? 'El token no tiene el permiso correcto (Cloudflare respondió 401/403).' : (err?.messageEs ?? 'Error desconocido.'),
        queHacer: err?.kind === 'auth'
          ? 'Crea un token nuevo con el permiso de Realtime (Admin) y cárgalo otra vez como Secret CF_API_TOKEN.'
          : err?.kind === 'not_found' ? 'Revisa CF_ACCOUNT_ID y RTK_APP_ID.' : 'Vuelve a comprobar en un minuto.',
      });
    }
    for (const [key, value] of [['PRESET_GUEST', config.presetGuest], ['PRESET_HOST', config.presetHost]] as const) {
      if (!value || presets.length === 0) continue;
      if (presets.includes(value)) checks.push({ nombre: `Preset ${key}`, estado: 'ok', detalle: `«${value}» existe en la aplicación.`, queHacer: '' });
      else checks.push({ nombre: `Preset ${key}`, estado: 'falla', detalle: `«${value}» no existe. Presets disponibles: ${presets.join(', ')}.`, queHacer: `Copia el nombre exacto de uno de esos presets en ${key}.` });
    }
  }

  // Meeting
  let puedeCrearReunion = false;
  if (!config.meetingId) {
    puedeCrearReunion = Boolean(canCallApi);
    checks.push({ nombre: 'Reunión', estado: 'falla', detalle: 'Todavía no hay reunión (RTK_MEETING_ID vacío).', queHacer: 'Pulsa «Crear la reunión» y pega el identificador en Cloudflare.' });
  } else if (canCallApi) {
    try {
      const m = await rtk.getMeeting();
      const inactive = m.status === 'INACTIVE';
      checks.push({
        nombre: 'Reunión',
        estado: inactive ? 'falla' : 'ok',
        detalle: `Existe${m.title ? ` («${m.title}»)` : ''}; estado: ${m.status ?? 'desconocido'}.`,
        queHacer: inactive ? 'La reunión está INACTIVA: actívala en el panel de RealtimeKit o crea otra borrando RTK_MEETING_ID.' : '',
      });
    } catch (e) {
      const err = e instanceof RtkError ? e : null;
      checks.push({ nombre: 'Reunión', estado: 'falla', detalle: err?.kind === 'not_found' ? 'RTK_MEETING_ID no corresponde a ninguna reunión de esta aplicación.' : (err?.messageEs ?? 'Error desconocido.'), queHacer: 'Revisa RTK_MEETING_ID o bórralo y crea la reunión desde aquí.' });
    }
  }

  // Window
  const w = eventWindow(now, config.opensAt, config.closesAt);
  const abreEnLima = config.opensAt === null ? null : formatLima(new Date(config.opensAt));
  const cierraEnLima = config.closesAt === null ? null : formatLima(new Date(config.closesAt));
  if (w.state === 'open') checks.push({ nombre: 'Ventana horaria', estado: 'ok', detalle: `ABIERTA. Cierra el ${cierraEnLima}.`, queHacer: '' });
  else if (w.state === 'before') checks.push({ nombre: 'Ventana horaria', estado: 'aviso', detalle: `Cerrada: se abre el ${abreEnLima}.`, queHacer: 'Nadie puede entrar todavía. Si es un ensayo, adelanta EVENT_OPENS_AT.' });
  else if (w.state === 'after') checks.push({ nombre: 'Ventana horaria', estado: 'aviso', detalle: `Cerrada: terminó el ${cierraEnLima}.`, queHacer: 'Si el evento sigue, amplía EVENT_CLOSES_AT.' });
  else checks.push({ nombre: 'Ventana horaria', estado: 'falla', detalle: 'Las fechas del evento faltan o no son válidas.', queHacer: 'Corrige EVENT_OPENS_AT y EVENT_CLOSES_AT.' });

  const inviteOk = !config.problems.some((p) => p.key === 'INVITE_CODE' && p.level === 'falla');
  const enlaceInvitacion = inviteOk ? `${url.origin}/?c=${encodeURIComponent(config.inviteCode)}` : null;
  checks.push(enlaceInvitacion
    ? { nombre: 'Enlace de invitación', estado: 'ok', detalle: 'Listo para copiar y enviar por WhatsApp.', queHacer: '' }
    : { nombre: 'Enlace de invitación', estado: 'falla', detalle: 'No se puede armar: INVITE_CODE falta o es corto.', queHacer: 'Corrige INVITE_CODE.' });

  return {
    modo: config.mock ? 'ensayo' : 'real',
    checks,
    puedeCrearReunion,
    enlaceInvitacion,
    presetsDisponibles: presets,
    ventana: { abierto: w.state === 'open', abreEnLima, cierraEnLima },
  };
}

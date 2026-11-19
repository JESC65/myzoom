import { useCallback, useEffect, useState } from 'react';
import { API, type CheckState, type CreateMeetingResponse, type DiagnosticsResponse } from '../../shared/contracts.ts';
import { getJson, postJson } from '../api.ts';
import { copyText } from '../clipboard.ts';

const ICON: Record<CheckState, string> = { ok: '✅', aviso: '⚠️', falla: '❌' };
const LABEL: Record<CheckState, string> = { ok: 'Bien', aviso: 'Aviso', falla: 'Falla' };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'' | 'ok' | 'fail'>('');
  return (
    <>
      <button type="button" className="btn btn--secondary" onClick={async () => setState((await copyText(text)) ? 'ok' : 'fail')}>{label}</button>
      <span className="small" aria-live="polite">{state === 'ok' ? ' Copiado ✓' : state === 'fail' ? ' No se pudo copiar; selecciónalo a mano.' : ''}</span>
    </>
  );
}

export function Diagnostics({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreateMeetingResponse | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const r = await getJson<DiagnosticsResponse>(API.hostDiagnostics);
    setLoading(false);
    if (r.ok) setData(r.data);
    else if (r.status === 401) onUnauthorized();
    else setError(r.error.error);
  }, [onUnauthorized]);

  useEffect(() => { void load(); }, [load]);

  async function createMeeting() {
    setCreating(true);
    setError('');
    const r = await postJson<CreateMeetingResponse>(API.hostCreateMeeting);
    setCreating(false);
    if (r.ok) setCreated(r.data);
    else if (r.status === 401) onUnauthorized();
    else setError(r.error.error);
  }

  return (
    <section className="card" aria-labelledby="diag-title">
      <h2 id="diag-title">Diagnóstico</h2>
      <button type="button" className="btn btn--secondary" onClick={() => void load()} disabled={loading}>
        {loading ? 'Comprobando…' : 'Volver a comprobar'}
      </button>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {data ? (
        <>
          <p data-testid="modo">Modo: <strong>{data.modo === 'ensayo' ? 'ENSAYO' : 'real'}</strong></p>
          {data.enlaceInvitacion ? (
            <div className="invite">
              <label htmlFor="invite-link">Enlace de invitación</label>
              <input id="invite-link" type="text" readOnly value={data.enlaceInvitacion} onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={data.enlaceInvitacion} label="Copiar enlace para WhatsApp" />
            </div>
          ) : null}
          {data.puedeCrearReunion && !created ? (
            <button type="button" className="btn btn--primary" onClick={() => void createMeeting()} disabled={creating}>
              {creating ? 'Creando…' : 'Crear la reunión'}
            </button>
          ) : null}
          {created ? (
            <div className="created" role="status">
              <label htmlFor="meeting-id">Identificador de la reunión</label>
              <input id="meeting-id" type="text" readOnly value={created.id} data-testid="meeting-id" onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={created.id} label="Copiar" />
              <p>{created.queHacer}</p>
            </div>
          ) : null}
          <ul className="checks">
            {data.checks.map((c, i) => (
              <li key={`${c.nombre}-${i}`} className={`check check--${c.estado}`}>
                <span aria-hidden="true" className="check__icon">{ICON[c.estado]}</span>
                <div>
                  <p className="check__name"><span className="sr-only">{LABEL[c.estado]}: </span>{c.nombre}</p>
                  <p>{c.detalle}</p>
                  {c.queHacer ? <p className="check__todo">Qué hacer: {c.queHacer}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : loading ? <p role="status">Comprobando…</p> : null}
    </section>
  );
}

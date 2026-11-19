import { useEffect, useRef, useState, type FormEvent } from 'react';
import { API, LIMITS, STATUS_POLL_MS, type JoinResponse, type StatusResponse } from '../../shared/contracts.ts';
import { MSG } from '../../shared/messages.ts';
import { validateGuestInput } from '../../shared/validate.ts';
import { getJson, postJson } from '../api.ts';
import { loadGuest, saveGuest } from '../storage.ts';
import { BrowserHint } from './BrowserHint.tsx';
import { Fallback, FallbackBanner } from './Fallback.tsx';
import { Header } from './Header.tsx';
import { Left } from './Left.tsx';
import { Room } from './Room.tsx';

type Phase =
  | { name: 'form' }
  | { name: 'room'; join: JoinResponse }
  | { name: 'left'; reason: string }
  | { name: 'fallback'; url: string };

export function Guest() {
  const code = new URLSearchParams(window.location.search).get('c')?.trim() ?? '';
  const saved = loadGuest();
  const [nombre, setNombre] = useState(saved.nombre);
  const [ciudad, setCiudad] = useState(saved.ciudad);
  const [phase, setPhase] = useState<Phase>({ name: 'form' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<'' | 'nombre' | 'ciudad'>('');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getJson<StatusResponse>(API.status).then((r) => { if (r.ok) setStatus(r.data); });
  }, []);

  // The only polling allowed: while inside the room, check every 60 s for the fallback (section 4.6).
  useEffect(() => {
    if (phase.name !== 'room') return;
    const id = setInterval(() => {
      void getJson<StatusResponse>(API.status).then((r) => { if (r.ok && r.data.respaldo) setFallbackNotice(true); });
    }, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [phase.name]);

  async function join(n: string, c: string) {
    setError('');
    setFieldError('');
    const local = validateGuestInput(n, c);
    if (!local.ok) {
      setFieldError(local.campo);
      setError(local.campo === 'nombre' ? MSG.nameInvalid : MSG.cityInvalid);
      (local.campo === 'nombre' ? nameRef : cityRef).current?.focus();
      return;
    }
    setBusy(true);
    const r = await postJson<JoinResponse>(API.guestJoin, { nombre: local.nombre, ciudad: local.ciudad, codigo: code });
    setBusy(false);
    if (r.ok) {
      saveGuest(local.nombre, local.ciudad);
      setFallbackNotice(false);
      setPhase({ name: 'room', join: r.data });
      return;
    }
    if (r.status === 409 && r.error.respaldo) {
      setPhase({ name: 'fallback', url: r.error.respaldo });
      return;
    }
    if (r.status === 400 && r.error.campo) setFieldError(r.error.campo);
    setError(r.error.error);
    if (phase.name !== 'form') setPhase({ name: 'left', reason: 'error' });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void join(nombre, ciudad);
  }

  if (phase.name === 'fallback') return <Fallback url={phase.url} />;

  if (phase.name === 'left') {
    return (
      <>
        <Left reason={phase.reason} busy={busy} error={error} onRejoin={() => { const s = loadGuest(); void join(s.nombre || nombre, s.ciudad || ciudad); }} />
        <div className="page page--tight"><BrowserHint /></div>
      </>
    );
  }

  if (phase.name === 'room') {
    const { join: j } = phase;
    return (
      <div className="room-layout">
        <BrowserHint compact />
        {fallbackNotice ? <FallbackBanner /> : null}
        <div className="room-layout__main">
          <Room authToken={j.authToken} modo={j.modo} nombreVisible={j.nombreVisible} rol="invitado" onLeft={(reason) => setPhase({ name: 'left', reason })} />
        </div>
      </div>
    );
  }

  return (
    <main className="page">
      <Header opensAt={status?.abreEn} closesAt={status?.cierraEn} />
      <BrowserHint />
      {status?.modo === 'ensayo' ? <p className="tag" role="status">Modo ensayo: nada de esto es una sala real.</p> : null}
      {!code ? (
        <section className="card" aria-labelledby="nocode-title">
          <h2 id="nocode-title">Falta el código de invitación</h2>
          <p className="error" role="alert">{MSG.missingInvite}</p>
        </section>
      ) : (
        <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="form-title">
          <h2 id="form-title">Entra a la reunión</h2>
          <label htmlFor="nombre">Tu nombre y apellido</label>
          <input
            id="nombre" ref={nameRef} name="nombre" type="text" autoComplete="name" required
            maxLength={LIMITS.nameMax + 10} value={nombre} onChange={(e) => setNombre(e.target.value)}
            aria-invalid={fieldError === 'nombre'} aria-describedby={fieldError === 'nombre' ? 'form-error' : undefined}
          />
          <label htmlFor="ciudad">¿Desde qué ciudad nos acompañas?</label>
          <input
            id="ciudad" ref={cityRef} name="ciudad" type="text" autoComplete="address-level2" required
            maxLength={LIMITS.cityMax + 10} value={ciudad} onChange={(e) => setCiudad(e.target.value)}
            aria-invalid={fieldError === 'ciudad'} aria-describedby={fieldError === 'ciudad' ? 'form-error' : undefined}
          />
          {error ? <p id="form-error" className="error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar a la reunión'}
          </button>
          <p className="small">Entrarás con la cámara y el micrófono apagados. Podrás encenderlos cuando quieras saludar.</p>
        </form>
      )}
    </main>
  );
}

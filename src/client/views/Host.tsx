import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { API, type JoinResponse } from '../../shared/contracts.ts';
import { getJson, postJson } from '../api.ts';
import { Diagnostics } from './Diagnostics.tsx';
import { Header } from './Header.tsx';
import { Room } from './Room.tsx';

type Tab = 'sala' | 'diagnostico';

export function Host() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'panel' | 'room'>('checking');
  const [tab, setTab] = useState<Tab>('sala');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [join, setJoin] = useState<JoinResponse | null>(null);
  const [leftNote, setLeftNote] = useState('');

  useEffect(() => {
    void getJson(API.hostSession).then((r) => setPhase(r.ok ? 'panel' : 'login'));
  }, []);

  const toLogin = useCallback(() => { setJoin(null); setPhase('login'); }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const r = await postJson(API.hostLogin, { clave });
    setBusy(false);
    setClave(''); // never kept in memory longer than needed, never stored
    if (r.ok) { setPhase('panel'); setTab('sala'); } else setError(r.error.error);
  }

  async function enterRoom() {
    setError('');
    setLeftNote('');
    setBusy(true);
    const r = await postJson<JoinResponse>(API.hostCredential);
    setBusy(false);
    if (r.ok) { setJoin(r.data); setPhase('room'); } else if (r.status === 401) toLogin(); else setError(r.error.error);
  }

  async function logout() {
    await postJson(API.hostLogout);
    setJoin(null);
    setPhase('login');
  }

  if (phase === 'checking') return <main className="page"><p role="status">Cargando…</p></main>;

  if (phase === 'room' && join) {
    // Full screen for the TV: no bars of our own over the UI Kit (section 5.2).
    return (
      <div className="room-full">
        <Room authToken={join.authToken} modo={join.modo} nombreVisible={join.nombreVisible} rol="anfitrion"
          onLeft={(reason) => { setJoin(null); setPhase('panel'); setTab('sala'); setLeftNote(reason === 'left' ? 'Saliste de la sala.' : 'Se cerró la sala. Puedes volver a entrar.'); }} />
      </div>
    );
  }

  if (phase === 'login') {
    return (
      <main className="page">
        <Header subtitle="Anfitrión · laptop del salón" />
        <form className="card" onSubmit={login} aria-labelledby="host-login-title">
          <h2 id="host-login-title">Entrar como anfitrión</h2>
          <label htmlFor="clave">Clave del anfitrión</label>
          <input id="clave" name="clave" type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} required
            aria-invalid={Boolean(error)} aria-describedby={error ? 'host-error' : undefined} />
          {error ? <p id="host-error" className="error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy || !clave}>{busy ? 'Comprobando…' : 'Entrar como anfitrión'}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="page page--wide">
      <Header subtitle="Anfitrión · laptop del salón" />
      <div className="tabs" role="tablist" aria-label="Panel del anfitrión">
        <button type="button" role="tab" id="tab-sala" aria-controls="panel-sala" aria-selected={tab === 'sala'} className="tab" onClick={() => setTab('sala')}>Sala</button>
        <button type="button" role="tab" id="tab-diag" aria-controls="panel-diag" aria-selected={tab === 'diagnostico'} className="tab" onClick={() => setTab('diagnostico')}>Diagnóstico</button>
      </div>
      {tab === 'sala' ? (
        <section id="panel-sala" role="tabpanel" aria-labelledby="tab-sala" className="card">
          <h2>Sala</h2>
          {leftNote ? <p role="status">{leftNote}</p> : null}
          <p>La laptop del salón entra con su cámara y su micrófono. Fijar, silenciar, participantes, chat y ajustes están dentro de la sala.</p>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button type="button" className="btn btn--primary btn--block" onClick={() => void enterRoom()} disabled={busy}>{busy ? 'Entrando…' : 'Entrar a la sala'}</button>
        </section>
      ) : (
        <div id="panel-diag" role="tabpanel" aria-labelledby="tab-diag">
          <Diagnostics onUnauthorized={toLogin} />
        </div>
      )}
      <button type="button" className="btn btn--ghost" onClick={() => void logout()}>Cerrar sesión de anfitrión</button>
    </main>
  );
}

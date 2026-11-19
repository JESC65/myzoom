import { Header } from './Header.tsx';

const REASONS: Record<string, string> = {
  left: 'Saliste de la reunión.',
  ended: 'La reunión terminó.',
  kicked: 'El anfitrión te retiró de la reunión.',
  disconnected: 'Se perdió la conexión.',
  failed: 'Se perdió la conexión y no pudimos reconectarte.',
  rejected: 'No se pudo entrar a la reunión.',
  error: 'No pudimos conectarte a la sala.',
};

export function Left({ reason, onRejoin, busy, error }: { reason: string; onRejoin: () => void; busy: boolean; error?: string }) {
  return (
    <main className="page">
      <Header />
      <section className="card" aria-labelledby="left-title">
        <h2 id="left-title">Saliste de la reunión</h2>
        <p>{REASONS[reason] ?? REASONS.left}</p>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="button" className="btn btn--primary btn--block" onClick={onRejoin} disabled={busy}>
          {busy ? 'Entrando…' : 'Volver a entrar'}
        </button>
      </section>
    </main>
  );
}

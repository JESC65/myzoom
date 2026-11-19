import { Header } from './Header.tsx';

/** Shown when /api/entrar answers 409: the meeting moved to the fallback room. */
export function Fallback({ url }: { url: string }) {
  return (
    <main className="page">
      <Header />
      <section className="card" aria-labelledby="fallback-title">
        <h2 id="fallback-title">Nos cambiamos de sala</h2>
        <p>La reunión continúa en la sala de respaldo. Toca el botón para ir allí.</p>
        <a className="btn btn--primary btn--block" href={url} rel="noreferrer">Ir a la sala de respaldo</a>
      </section>
    </main>
  );
}

/** Fixed banner inside the room when /api/estado reports the fallback (section 4.6). */
export function FallbackBanner() {
  return (
    <div className="banner" role="alert">
      {/* "/" answers 302 to FALLBACK_URL, so the URL never has to reach the client here. */}
      <a className="banner__link" href="/">Nos cambiamos de sala. Toca aquí para ir a la sala de respaldo.</a>
    </div>
  );
}

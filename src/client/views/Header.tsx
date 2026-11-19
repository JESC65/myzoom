import { formatLimaWindow } from '../../shared/time-format.ts';

export function Header({ opensAt, closesAt, subtitle }: { opensAt?: string | null; closesAt?: string | null; subtitle?: string }) {
  const windowLine = opensAt && closesAt ? formatLimaWindow(opensAt, closesAt) : '';
  return (
    <header className="header">
      <img className="header__badge" src="/insignia.jpg" width={76} height={96} alt="Insignia del Colegio San Antonio" />
      <div>
        <h1 className="header__title">Promoción 81 · Reunión virtual</h1>
        {subtitle ? <p className="header__line">{subtitle}</p> : null}
        {windowLine ? <p className="header__line">{windowLine}</p> : null}
      </div>
    </header>
  );
}

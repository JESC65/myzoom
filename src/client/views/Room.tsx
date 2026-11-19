import { lazy, Suspense, useEffect } from 'react';
import type { Mode, Role } from '../../shared/contracts.ts';
import { keepScreenOn } from '../wakeLock.ts';

const RealRoom = lazy(() => import('./RealRoom.tsx'));

export interface RoomProps {
  authToken: string;
  modo: Mode;
  nombreVisible: string;
  rol: Role;
  onLeft: (reason: string) => void;
}

/** Mock mode shows a "Sala de ensayo" box instead of RtkMeeting (section 4.8). */
function MockRoom({ nombreVisible, rol, onLeft }: RoomProps) {
  return (
    <section className="card mock-room" aria-labelledby="mock-title" data-testid="sala-ensayo">
      <h2 id="mock-title">Sala de ensayo</h2>
      <p>Esto es una simulación: aquí aparecerá la sala real de video.</p>
      <dl className="mock-room__data">
        <dt>Nombre visible</dt>
        <dd data-testid="nombre-visible">{nombreVisible}</dd>
        <dt>Rol</dt>
        <dd data-testid="rol">{rol === 'anfitrion' ? 'anfitrión' : 'invitado'}</dd>
      </dl>
      <button type="button" className="btn btn--primary btn--block" onClick={() => onLeft('left')}>Salir</button>
    </section>
  );
}

export function Room(props: RoomProps) {
  useEffect(() => keepScreenOn(), []);
  if (props.modo === 'ensayo') return <MockRoom {...props} />;
  return (
    <Suspense fallback={<p className="loading" role="status">Conectando con la sala…</p>}>
      <RealRoom authToken={props.authToken} rol={props.rol} onLeft={props.onLeft} />
    </Suspense>
  );
}

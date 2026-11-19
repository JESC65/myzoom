import { Guest } from './views/Guest.tsx';
import { Host } from './views/Host.tsx';

/** Two routes only: "/" (guest) and "/anfitrion" (host laptop). */
export function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path === '/anfitrion' ? <Host /> : <Guest />;
}

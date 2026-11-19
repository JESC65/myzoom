// Screen Wake Lock (optional, section 5.1): never blocks anything if it fails.
type Sentinel = { release(): Promise<void> };

export function keepScreenOn(): () => void {
  let sentinel: Sentinel | null = null;
  let active = true;
  const request = async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }).wakeLock;
      if (wl && document.visibilityState === 'visible') sentinel = await wl.request('screen');
    } catch {
      sentinel = null;
    }
  };
  const onVisible = () => { if (active && document.visibilityState === 'visible') void request(); };
  void request();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisible);
    void sentinel?.release().catch(() => undefined);
  };
}

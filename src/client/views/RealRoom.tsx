// The real room: standard RealtimeKit UI Kit (RtkMeeting). No custom controls (section 5.2).
import { useEffect, useRef } from 'react';
import { useRealtimeKitClient } from '@cloudflare/realtimekit-react';
import { RtkMeeting, useLanguage } from '@cloudflare/realtimekit-react-ui';
import type { Role } from '../../shared/contracts.ts';
import { es } from '../i18n/es.ts';
import { isEndingState } from '../roomState.ts';

// useLanguage is a plain factory (not a React hook) in the UI Kit.
const t = useLanguage(es);


export default function RealRoom({ authToken, rol, onLeft }: { authToken: string; rol: Role; onLeft: (reason: string) => void }) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const onLeftRef = useRef(onLeft);
  onLeftRef.current = onLeft;

  useEffect(() => {
    const isHost = rol === 'anfitrion';
    // Guests join with camera and microphone OFF (section 5.1). The host laptop starts with both on.
    initMeeting({ authToken, defaults: { audio: isHost, video: isHost } })
      .then((m) => { if (!m) onLeftRef.current('error'); })
      .catch(() => onLeftRef.current('error'));
  }, [authToken, rol, initMeeting]);

  useEffect(() => {
    if (!meeting) return;
    const handler = ({ state }: { state: string }) => { if (isEndingState(state)) onLeftRef.current(state); };
    meeting.self.addListener('roomLeft', handler);
    return () => { meeting.self.removeListener('roomLeft', handler); };
  }, [meeting]);

  if (!meeting) return <p className="loading" role="status">Conectando con la sala…</p>;
  return (
    <div className="rtk-wrap">
      {/* showSetupScreen=false: joins directly with the defaults above, no permission prompt to enter (D-005). */}
      <RtkMeeting meeting={meeting} showSetupScreen={false} t={t} mode="fill" leaveOnUnmount />
    </div>
  );
}

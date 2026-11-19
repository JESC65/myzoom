import { useState } from 'react';
import { MSG } from '../../shared/messages.ts';
import { copyText } from '../clipboard.ts';

/** WhatsApp/Facebook/Instagram in-app browsers often block audio or the camera. Detection is only a hint. */
export function isInAppBrowser(ua: string = navigator.userAgent): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\//i.test(ua);
}

export function BrowserHint({ compact = false }: { compact?: boolean }) {
  const inApp = isInAppBrowser();
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('');
  return (
    <div className={`hint${inApp ? ' hint--strong' : ''}${compact ? ' hint--compact' : ''}`} role="note">
      <span>{MSG.browserHint}</span>
      {inApp ? (
        <>
          <button type="button" className="btn btn--small" onClick={async () => setCopied((await copyText(window.location.href)) ? 'ok' : 'fail')}>
            Copiar enlace
          </button>
          <span aria-live="polite">{copied === 'ok' ? ' Enlace copiado. Pégalo en Chrome o Safari.' : copied === 'fail' ? ' No se pudo copiar: mantén presionada la dirección.' : ''}</span>
        </>
      ) : null}
    </div>
  );
}

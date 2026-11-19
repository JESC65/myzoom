// Small HTTP helpers for the API (section 4.3).
import { LIMITS } from '../shared/contracts.ts';
import { MSG } from '../shared/messages.ts';

export const API_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
} as const;

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...API_HEADERS, ...extra } });
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return json({ error, ...extra }, status, headers);
}

export type BodyResult = { ok: true; body: Record<string, unknown> } | { ok: false; response: Response };

/** JSON-only, at most 2 KB, same Origin when present. Reads the stream with a hard cap. */
export async function readJsonBody(request: Request, url: URL): Promise<BodyResult> {
  const origin = request.headers.get('Origin');
  if (origin !== null && origin !== url.origin) return { ok: false, response: jsonError(403, MSG.foreignOrigin) };

  const type = (request.headers.get('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase();
  if (type !== 'application/json') return { ok: false, response: jsonError(415, MSG.wrongContentType) };

  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declared) && declared > LIMITS.bodyMaxBytes) return { ok: false, response: jsonError(413, MSG.bodyTooLarge) };

  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.bodyMaxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, response: jsonError(413, MSG.bodyTooLarge) };
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, response: jsonError(400, MSG.badRequest) };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, response: jsonError(400, MSG.badRequest) };
  return { ok: true, body: parsed as Record<string, unknown> };
}

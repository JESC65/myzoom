// Constant-time comparison, signed host cookie and security headers (sections 4.5 and 6).
import { HOST_COOKIE_NAME } from '../shared/contracts.ts';

const enc = new TextEncoder();

async function sha256(value: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

/**
 * Compares two strings in constant time over their SHA-256 digests (always 32 bytes),
 * so there is no early exit on length or on the first different byte.
 */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= (da[i] ?? 0) ^ (db[i] ?? 0);
  return diff === 0;
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function cookieKey(hostSecret: string): Promise<CryptoKey> {
  // Key derived from HOST_SECRET: changing the secret invalidates every cookie.
  const raw = await sha256(`myzoom/host-cookie/v1/${hostSecret}`);
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(payload: string, hostSecret: string): Promise<string> {
  const key = await cookieKey(hostSecret);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))));
}

/** Cookie value: v1.{expiresEpochSeconds}.{HMAC-SHA-256 signature}. */
export async function createHostToken(expiresAtMs: number, hostSecret: string): Promise<string> {
  const exp = Math.floor(expiresAtMs / 1000);
  const payload = `v1.${exp}`;
  return `${payload}.${await sign(payload, hostSecret)}`;
}

/**
 * Valid when well formed, signed with the current HOST_SECRET, not expired and
 * not beyond the current event close (so shortening EVENT_CLOSES_AT also shortens cookies).
 */
export async function verifyHostToken(
  value: string | null,
  hostSecret: string,
  nowMs: number,
  maxExpiresAtMs: number | null,
): Promise<boolean> {
  if (!value || value.length > 200) return false;
  const m = /^v1\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!m) return false;
  const exp = Number(m[1]);
  const expected = await sign(`v1.${exp}`, hostSecret);
  const sigOk = await safeEqual(m[2] ?? '', expected);
  if (!sigOk) return false;
  if (exp * 1000 <= nowMs) return false;
  if (maxExpiresAtMs !== null && exp * 1000 > maxExpiresAtMs + 1000) return false;
  return true;
}

export function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

// Chromium accepts __Host- + Secure on http://localhost, so mock mode needs no variant (D-007).
export function hostCookieHeader(value: string, expiresAtMs: number): string {
  return `${HOST_COOKIE_NAME}=${value}; Path=/; Expires=${new Date(expiresAtMs).toUTCString()}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearHostCookieHeader(): string {
  return `${HOST_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

/**
 * Content-Security-Policy for pages. RealtimeKit picks media/socket hosts at runtime,
 * so connect-src allows any https/wss origin (documented in D-009).
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com https://rtk-assets.realtime.cloudflare.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: mediastream: https:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "frame-src 'self' https:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const PERMISSIONS_POLICY = 'camera=(self), microphone=(self), display-capture=(self), autoplay=(self), screen-wake-lock=(self), geolocation=(), payment=(), usb=()';

/** Adds security headers to a page/asset response (returns a new Response). */
export function withSecurityHeaders(response: Response, isHtml: boolean): Response {
  const headers = new Headers(response.headers);
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  if (isHtml) {
    headers.set('Content-Security-Policy', CSP);
    headers.set('Cache-Control', 'no-store');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

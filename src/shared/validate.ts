// Input validators shared by client (early feedback) and Worker (authoritative).
import { LIMITS } from './contracts.ts';

// C0/C1 controls and bidi/format overrides that can spoof how a name renders.
const STRIP_RE = /[\p{Cc}​‎‏‪-‮⁠⁦-⁩﻿<>]/gu;

/** Trim, drop control characters and angle brackets, collapse spaces, NFC. */
export function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(STRIP_RE, '').replace(/\s+/gu, ' ').trim();
}

/** Length in user-visible code points. */
export function textLength(value: string): number {
  return [...value].length;
}

export type GuestInputResult =
  | { ok: true; nombre: string; ciudad: string }
  | { ok: false; campo: 'nombre' | 'ciudad' };

export function validateGuestInput(nombreRaw: unknown, ciudadRaw: unknown): GuestInputResult {
  const nombre = cleanText(nombreRaw);
  const ciudad = cleanText(ciudadRaw);
  const nl = textLength(nombre);
  if (nl < LIMITS.nameMin || nl > LIMITS.nameMax) return { ok: false, campo: 'nombre' };
  const cl = textLength(ciudad);
  if (cl < LIMITS.cityMin || cl > LIMITS.cityMax) return { ok: false, campo: 'ciudad' };
  return { ok: true, nombre, ciudad };
}

export function displayNameFor(nombre: string, ciudad: string): string {
  return `${nombre} · ${ciudad}`;
}

/** FALLBACK_URL rule: https only, no credentials, parseable. Returns the normalized URL or null. */
export function validFallbackUrl(value: string | undefined | null): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (!url.hostname) return null;
  return url.toString();
}

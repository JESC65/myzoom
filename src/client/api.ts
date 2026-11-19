// Thin fetch wrappers over the frozen contract in src/shared/contracts.ts.
import { MSG } from '../shared/messages.ts';
import type { ErrorResponse } from '../shared/contracts.ts';

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ErrorResponse };

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: unknown = null;
    try { data = await res.json(); } catch { data = null; }
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    const err = (data && typeof data === 'object' && 'error' in data ? data : { error: MSG.serviceError }) as ErrorResponse;
    return { ok: false, status: res.status, error: err };
  } catch {
    return { ok: false, status: 0, error: { error: MSG.serviceError } };
  }
}

export const getJson = <T,>(path: string) => request<T>('GET', path);
export const postJson = <T,>(path: string, body: unknown = {}) => request<T>('POST', path, body);

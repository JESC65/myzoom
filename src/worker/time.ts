// Event window (section 4.4): open iff opensAt <= now < closesAt.
import { formatLima } from '../shared/time-format.ts';

export type WindowState =
  | { state: 'open' }
  | { state: 'before'; opensLima: string }
  | { state: 'after' }
  | { state: 'unknown' };

export function eventWindow(now: number, opensAt: number | null, closesAt: number | null): WindowState {
  if (opensAt === null || closesAt === null) return { state: 'unknown' };
  if (now < opensAt) return { state: 'before', opensLima: formatLima(new Date(opensAt)) };
  if (now >= closesAt) return { state: 'after' };
  return { state: 'open' };
}

export { formatLima };

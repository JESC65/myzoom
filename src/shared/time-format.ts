// Lima time formatting (America/Lima, UTC-5, no DST). Deterministic Spanish output.

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

interface LimaParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

function limaParts(date: Date): LimaParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday ?? '');
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour) % 24, minute: Number(p.minute), weekday: wd,
  };
}

/** "9:05 a. m." style, 12-hour clock as people in Lima read it. */
export function formatLimaTime(date: Date): string {
  const { hour, minute } = limaParts(date);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'a. m.' : 'p. m.';
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** "sábado 21 de noviembre a las 9:00 a. m. (hora de Lima)" */
export function formatLima(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  const p = limaParts(date);
  return `${WEEKDAYS[p.weekday]} ${p.day} de ${MONTHS[p.month - 1]} a las ${formatLimaTime(date)} (hora de Lima)`;
}

/** Short window line for the header: "Del sábado 21 de noviembre, 9:00 a. m. al domingo 22, 6:00 a. m. (hora de Lima)" */
export function formatLimaWindow(opensIso: string, closesIso: string): string {
  const o = new Date(opensIso);
  const c = new Date(closesIso);
  if (Number.isNaN(o.getTime()) || Number.isNaN(c.getTime())) return '';
  const po = limaParts(o);
  const pc = limaParts(c);
  const left = `${WEEKDAYS[po.weekday]} ${po.day} de ${MONTHS[po.month - 1]}, ${formatLimaTime(o)}`;
  const sameMonth = po.month === pc.month && po.year === pc.year;
  const right = `${WEEKDAYS[pc.weekday]} ${pc.day}${sameMonth ? '' : ` de ${MONTHS[pc.month - 1]}`}, ${formatLimaTime(c)}`;
  return `Del ${left} al ${right} (hora de Lima)`;
}

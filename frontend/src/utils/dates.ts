const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Date-only fields are stored by the backend as UTC midnight, so they are calendar dates, not instants.
const UTC_MIDNIGHT_RE = /^(\d{4}-\d{2}-\d{2})T00:00:00(\.0+)?Z$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in the browser's local time zone ('' for empty/invalid input). */
export function toLocalDateKey(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') {
    if (DATE_ONLY_RE.test(value)) return value;
    const midnight = UTC_MIDNIGHT_RE.exec(value);
    if (midnight) return midnight[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight Date for a "YYYY-MM-DD" key. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayKey(now: Date = new Date()): string {
  return toLocalDateKey(now);
}

/** Whole days from `a` to `b` (b - a), DST-safe. */
export function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function shiftDateKey(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
}

export function shiftMonthsKey(key: string, months: number): string {
  const d = parseDateKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toLocalDateKey(d);
}

// Dates, IDs and sizes as the designs show them.
import { PORTAL } from '@/config/portal';

const DAY = 86400_000;
const parse = (d: string | Date) => (d instanceof Date ? d : new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d));

/** "31 Jan 2027" */
export const fmtDate = (d?: string | Date | null) =>
  d ? parse(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** "2 Nov 2026 · 10:05" */
export const fmtDateTime = (d?: string | Date | null) =>
  d ? `${fmtDate(d)} · ${parse(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '—';

/** Clock time in the portal's audit time zone, "10:05:16". */
export const fmtClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: PORTAL.timeZone.iana, hour12: false });

/** Day key in the audit zone, "2026-11-03". */
export const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: PORTAL.timeZone.iana });

/** "Tue, 3 Nov 2026" */
export const fmtDayLong = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Whole days from now until a date (negative = past). */
export const daysUntil = (d: string | Date) => Math.ceil((parse(d).getTime() - Date.now()) / DAY);

export function relativeExpiry(d?: string | null): { text: string; tone: 'muted' | 'warn' | 'bad' } {
  if (!d) return { text: 'No expiry', tone: 'muted' };
  const n = daysUntil(d);
  if (n < 0) return { text: `Ended ${-n} day${n === -1 ? '' : 's'} ago`, tone: 'muted' };
  if (n === 0) return { text: 'Ends today', tone: 'bad' };
  return { text: `in ${n} day${n === 1 ? '' : 's'}`, tone: n <= 30 ? 'warn' : 'muted' };
}

/** "vc-3b9e…c40d" style short form of a long ID. */
export function shortId(id?: string | null, head = 4, tail = 4) {
  if (!id) return '—';
  const s = id.replace(/^urn:uuid:/, '');
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export const fmtSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export const fmtAmount = (currency?: string, amount?: string) => {
  if (!amount) return '—';
  const n = Number(String(amount).replace(/,/g, ''));
  const v = Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount;
  return `${currency ?? ''} ${v}`.trim();
};

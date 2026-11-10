// Turns API audit lines into the events the Audit log page shows.
import type { AuditLine } from './trustApi';

export type AuditCategory = 'issuing' | 'verification' | 'inbox' | 'partners' | 'access';
export type ResultTone = 'ok' | 'bad' | 'warn' | 'none';

export interface AuditEvent {
  key: string;
  time: string;
  label: string;
  code: string;
  category: AuditCategory;
  by: string;
  txId: string | null;
  vcId: string | null;
  result: { text: string; tone: ResultTone } | null;
  problem: boolean;
  details: { label: string; value: string; mono?: boolean }[];
  line: AuditLine;
}

const MAP: Record<string, { label: string; code: string; category: AuditCategory }> = {
  'elc.issue': { label: 'eLC issued', code: 'ELC_ISSUED', category: 'issuing' },
  'admin.vc.register': { label: 'eLC registered', code: 'ELC_REGISTERED', category: 'issuing' },
  'admin.vc.suspend': { label: 'eLC suspended', code: 'ELC_SUSPENDED', category: 'issuing' },
  'vc.verify': { label: 'Content check', code: 'VERIFY_CONTENT', category: 'verification' },
  'vp.verification-context': { label: 'Status & trust check', code: 'VERIFY_STATUS', category: 'verification' },
  'inbox.send': { label: 'File sent to inbox', code: 'INBOX_SEND', category: 'inbox' },
  'inbox.download': { label: 'Inbox file downloaded', code: 'INBOX_DOWNLOAD', category: 'inbox' },
  'inbox.ack': { label: 'Inbox file marked read', code: 'INBOX_ACK', category: 'inbox' },
  'inbox.delete': { label: 'Inbox file deleted', code: 'INBOX_DELETE', category: 'inbox' },
  'partner.register': { label: 'Partner registered', code: 'PARTNER_REGISTER', category: 'partners' },
  'admin.otp.issue': { label: 'Registration code issued', code: 'PARTNER_OTP', category: 'partners' },
  'admin.partner.revoke': { label: 'Partner revoked', code: 'PARTNER_REVOKE', category: 'partners' },
  'auth.partner': { label: 'Access denied', code: 'AUTH_DENIED', category: 'access' },
  'auth.admin': { label: 'Access denied', code: 'AUTH_DENIED', category: 'access' },
  error: { label: 'Server error', code: 'ERROR', category: 'access' },
};

const SKIP = new Set(['time', 'requestId', 'partner', 'action', 'outcome', 'results']);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

function result(line: AuditLine): { text: string; tone: ResultTone } | null {
  const o = line.outcome;
  if (line.action === 'vp.verification-context') {
    const r = (line.results as { status: string; trusted: boolean }[] | undefined)?.[0];
    if (r) return r.status === 'active' && r.trusted ? { text: 'Active', tone: 'ok' } : { text: r.status === 'active' ? 'Untrusted' : r.status.replace('_', ' '), tone: 'bad' };
  }
  if (o === 'pass') return { text: 'Passed', tone: 'ok' };
  if (o === 'fail') return { text: 'Failed', tone: 'bad' };
  if (o === 'denied') return { text: 'Denied', tone: 'bad' };
  if (o === 'failed') return { text: 'Failed', tone: 'bad' };
  if (line.action === 'elc.issue' && o === 'ok') return { text: 'Active', tone: 'ok' };
  if (o === 'ok') return { text: 'Done', tone: 'ok' };
  return null;
}

export function toEvent(line: AuditLine, i: number): AuditEvent {
  const m = MAP[line.action] ?? { label: line.action, code: line.action.toUpperCase().replace(/\W+/g, '_'), category: 'access' as const };
  const r = result(line);
  const ctx = (line.results as { vcId?: string; txId?: string }[] | undefined)?.[0];
  const details = [
    { label: 'Request ID', value: line.requestId, mono: true },
    ...Object.entries(line)
      .filter(([k, v]) => !SKIP.has(k) && v != null && typeof v !== 'object')
      .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), value: String(v), mono: /id$|sha|did/i.test(k) })),
    { label: 'Content stored', value: 'None · IDs and result only' },
  ];
  return {
    key: `${line.time}-${line.requestId}-${i}`,
    time: line.time,
    label: m.label,
    code: m.code,
    category: m.category,
    by: line.partner ?? '—',
    txId: str(line.txId) ?? str(ctx?.txId),
    vcId: str(line.vcId) ?? str(ctx?.vcId),
    result: r,
    problem: r?.tone === 'bad',
    details,
    line,
  };
}

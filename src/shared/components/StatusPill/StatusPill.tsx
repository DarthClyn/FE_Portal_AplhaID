import './StatusPill.css';

export type PillTone = 'ok' | 'bad' | 'warn' | 'neutral' | 'info';

const STATUS_TONE: Record<string, PillTone> = { active: 'ok', passed: 'ok', expired: 'neutral', suspended: 'warn', not_found: 'bad', failed: 'bad', untrusted: 'bad', new: 'info', read: 'neutral' };

export function StatusPill({ status, tone, dot = true, solid = false }: { status: string; tone?: PillTone; dot?: boolean; solid?: boolean }) {
  const t = tone ?? STATUS_TONE[status.toLowerCase()] ?? 'neutral';
  const text = status.replace('_', ' ').replace(/^./, (c) => c.toUpperCase());
  return <span className={`pill pill--${t}${solid ? ' pill--solid' : ''}`}>{dot && !solid && <span className="pill__dot" />}{text}</span>;
}

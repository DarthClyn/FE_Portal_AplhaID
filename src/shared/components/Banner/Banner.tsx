import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, Lock, X } from 'lucide-react';
import './Banner.css';

const ICONS = { ok: CheckCircle2, bad: AlertCircle, info: Info, lock: Lock };

export function Banner({ tone = 'info', title, children, onClose, action }: { tone?: 'ok' | 'bad' | 'info' | 'lock'; title: ReactNode; children?: ReactNode; onClose?: () => void; action?: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <div className={`banner banner--${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon size={18} className="banner__icon" />
      <div className="banner__text">
        <strong>{title}</strong>
        {children && <span>{children}</span>}
      </div>
      {action && <div className="banner__action">{action}</div>}
      {onClose && <button className="banner__close" onClick={onClose} aria-label="Dismiss"><X size={16} /></button>}
    </div>
  );
}

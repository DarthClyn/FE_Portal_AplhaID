import type { ReactNode } from 'react';
import './EmptyState.css';

export const EmptyState = ({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) => (
  <div className="empty">
    {icon && <span className="empty__icon">{icon}</span>}
    <strong>{title}</strong>
    {children && <span className="muted">{children}</span>}
  </div>
);

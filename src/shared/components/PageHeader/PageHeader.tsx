import type { ReactNode } from 'react';
import './PageHeader.css';

export const PageHeader = ({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: ReactNode; actions?: ReactNode }) => (
  <header className="page-header">
    <div className="page-header__text">
      {back}
      <h1>{title}</h1>
      {subtitle && <p className="page-header__sub">{subtitle}</p>}
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </header>
);

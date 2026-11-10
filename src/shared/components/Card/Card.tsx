import type { HTMLAttributes, ReactNode } from 'react';
import './Card.css';

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'ok' | 'bad' | 'warn';
  padded?: boolean;
  children: ReactNode;
}

export const Card = ({ tone = 'default', padded = true, className = '', children, ...rest }: Props) => (
  <div className={`card card--${tone}${padded ? ' card--padded' : ''} ${className}`} {...rest}>{children}</div>
);

export const CardTitle = ({ children, aside }: { children: ReactNode; aside?: ReactNode }) => (
  <div className="card__title"><h2>{children}</h2>{aside}</div>
);

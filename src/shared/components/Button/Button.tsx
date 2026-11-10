import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '../Spinner/Spinner';
import './Button.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
  size?: 'md' | 'lg' | 'sm';
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', icon, loading, block, children, className = '', disabled, ...rest }: Props) {
  return (
    <button
      className={`btn btn--${variant} btn--${size}${block ? ' btn--block' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  );
}

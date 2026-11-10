import { useEffect, useRef, useState, type ReactNode } from 'react';
import './Popover.css';

/** A trigger and a floating panel that closes on outside click or Escape. */
export function Popover({ trigger, children, align = 'right', width }: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="popover" ref={ref} onClick={(e) => e.stopPropagation()}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && <div className={`popover__panel popover__panel--${align}`} style={width ? { width } : undefined}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export const MenuHeading = ({ children }: { children: ReactNode }) => <div className="menu__heading">{children}</div>;
export const MenuDivider = () => <div className="menu__divider" />;
export const MenuItem = ({ icon, children, onClick, active, danger, disabled, title }: {
  icon?: ReactNode; children: ReactNode; onClick: () => void; active?: boolean; danger?: boolean; disabled?: boolean; title?: string;
}) => (
  <button type="button" role="menuitem" title={title} disabled={disabled} onClick={onClick}
    className={`menu__item${active ? ' menu__item--active' : ''}${danger ? ' menu__item--danger' : ''}`}>
    {icon && <span className="menu__icon">{icon}</span>}
    <span className="menu__label">{children}</span>
  </button>
);

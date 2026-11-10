import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import './Collapsible.css';

interface Props {
  title: ReactNode;
  summary?: ReactNode;
  aside?: ReactNode;
  number?: number;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
  variant?: 'flush' | 'card';
}

/** A section that opens and closes; "flush" sits inside a card (Issue form), "card" stands alone (eLC detail). */
export function Collapsible({ title, summary, aside, number, open, onToggle, children, variant = 'flush' }: Props) {
  return (
    <section className={`coll coll--${variant}${open ? ' coll--open' : ''}`}>
      <button className="coll__head" onClick={onToggle} aria-expanded={open}>
        {number != null && <span className="coll__num">{number}</span>}
        <span className={`coll__titles${variant === 'card' ? ' coll__titles--stack' : ''}`}>
          <span className="coll__title">{title}</span>
          {summary && <span className="coll__summary">{summary}</span>}
        </span>
        <span className="coll__aside">{aside}</span>
        {open ? <ChevronUp size={18} className="coll__chev" /> : <ChevronDown size={18} className="coll__chev" />}
      </button>
      {open && <div className="coll__body">{children}</div>}
    </section>
  );
}

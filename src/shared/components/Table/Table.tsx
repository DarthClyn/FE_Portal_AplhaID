import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Table.css';

export const TableCard = ({ toolbar, children, footer }: { toolbar?: ReactNode; children: ReactNode; footer?: ReactNode }) => (
  <div className="table-card">
    {toolbar && <div className="table-card__toolbar">{toolbar}</div>}
    <div className="table-card__scroll">{children}</div>
    {footer && <div className="table-card__footer">{footer}</div>}
  </div>
);

/** Page buttons: 1 2 3 … last, as in the designs. */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const list: (number | '…')[] = pages <= 6 ? Array.from({ length: pages }, (_, i) => i + 1)
    : page <= 3 ? [1, 2, 3, '…', pages]
      : page >= pages - 2 ? [1, '…', pages - 2, pages - 1, pages]
        : [1, '…', page, '…', pages];
  return (
    <div className="pager">
      <button className="pager__btn" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Previous"><ChevronLeft size={15} /></button>
      {list.map((p, i) => p === '…'
        ? <span key={`e${i}`} className="pager__btn pager__btn--gap">…</span>
        : <button key={p} className={`pager__btn${p === page ? ' pager__btn--on' : ''}`} onClick={() => onPage(p)}>{p}</button>)}
      <button className="pager__btn" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="Next"><ChevronRight size={15} /></button>
    </div>
  );
}

export const paginate = <T,>(rows: T[], page: number, size: number) => rows.slice((page - 1) * size, page * size);

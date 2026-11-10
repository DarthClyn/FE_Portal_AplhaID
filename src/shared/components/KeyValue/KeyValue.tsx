import type { ReactNode } from 'react';
import './KeyValue.css';

export interface KV { label: string; value: ReactNode }

/** Label left, value right, as in the summary cards. */
export const KeyValue = ({ rows, divider }: { rows: KV[]; divider?: boolean }) => (
  <dl className={`kv${divider ? ' kv--divider' : ''}`}>
    {rows.map((r) => (
      <div className="kv__row" key={r.label}>
        <dt>{r.label}</dt>
        <dd>{r.value}</dd>
      </div>
    ))}
  </dl>
);

/** Label above value, two columns (read-only eLC fields). */
export const FieldValues = ({ rows }: { rows: { label: string; tag?: string; value: ReactNode; wide?: boolean }[] }) => (
  <div className="fv">
    {rows.map((r) => (
      <div key={r.label} className={`fv__item${r.wide ? ' fv__item--wide' : ''}`}>
        <span className="fv__label">{r.label}{r.tag && <span className="fv__tag">{r.tag}</span>}</span>
        <span className="fv__value">{r.value}</span>
      </div>
    ))}
  </div>
);

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText } from '@/shared/services/files';
import { shortId } from '@/shared/services/format';
import './CopyId.css';

/** Monospace ID with a copy button; long IDs are shortened in the middle unless `full`. */
export function CopyId({ value, full, head, tail }: { value?: string | null; full?: boolean; head?: number; tail?: number }) {
  const [done, setDone] = useState(false);
  if (!value) return <span className="faint">—</span>;
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await copyText(value)) { setDone(true); setTimeout(() => setDone(false), 1200); }
  };
  return (
    <span className="copy-id" title={value}>
      <span className="mono">{full ? value : shortId(value, head, tail)}</span>
      <button className="copy-id__btn" onClick={copy} aria-label="Copy">{done ? <Check size={13} /> : <Copy size={13} />}</button>
    </span>
  );
}

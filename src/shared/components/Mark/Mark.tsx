import { AlertTriangle, Check, Minus, X } from 'lucide-react';
import './Mark.css';

export type MarkState = 'pass' | 'fail' | 'error' | 'todo' | 'na';

/** Round status mark: green check, red cross, amber warning, grey dash (not relied on). */
export function Mark({ state, size = 20 }: { state: MarkState; size?: number }) {
  const icon = Math.round(size * 0.62);
  return (
    <span className={`mark mark--${state}`} style={{ width: size, height: size }} aria-label={state}>
      {state === 'pass' && <Check size={icon} strokeWidth={3} />}
      {state === 'fail' && <X size={icon} strokeWidth={3} />}
      {state === 'error' && <AlertTriangle size={icon} strokeWidth={2.5} />}
      {state === 'na' && <Minus size={icon} strokeWidth={3} />}
    </span>
  );
}

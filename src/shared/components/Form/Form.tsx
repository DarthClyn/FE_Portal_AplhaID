import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import './Form.css';

interface FieldProps {
  label: string;
  tag?: string;
  required?: boolean;
  error?: string;
  wide?: boolean;
  children: ReactNode;
  htmlFor?: string;
}

/** Label (with MT700 tag and required star), control, and an error line. */
export const Field = ({ label, tag, required, error, wide, children, htmlFor }: FieldProps) => (
  <div className={`field${wide ? ' field--wide' : ''}${error ? ' field--error' : ''}`}>
    <label className="field__label" htmlFor={htmlFor}>
      {label}
      {required && <span className="field__req">*</span>}
      {tag && <span className="field__tag">{tag}</span>}
    </label>
    {children}
    {error && <span className="field__error"><AlertCircle size={13} /> {error}</span>}
  </div>
);

export const FieldGrid = ({ children }: { children: ReactNode }) => <div className="field-grid">{children}</div>;

export const TextInput = (p: InputHTMLAttributes<HTMLInputElement>) => <input className="input" {...p} />;

export const TextArea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="input input--area" rows={3} {...p} />;

export const Select = ({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="select">
    <select className="input" {...p}>{children}</select>
    <ChevronDown size={16} className="select__chev" />
  </div>
);

export function Segmented({ options, value, onChange, id }: { options: { value: string; label: string }[]; value?: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="segmented" role="radiogroup" id={id}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={`segmented__opt${value === o.value ? ' segmented__opt--on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Checkbox = ({ label, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="checkbox"><input type="checkbox" {...p} /> {label}</label>
);

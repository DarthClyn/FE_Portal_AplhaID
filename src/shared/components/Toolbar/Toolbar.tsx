import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import './Toolbar.css';

export const SearchInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <label className="search">
    <Search size={15} />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </label>
);

export const Chip = ({ on, tone, onClick, children }: { on?: boolean; tone?: 'bad'; onClick: () => void; children: ReactNode }) => (
  <button className={`chip${on ? ' chip--on' : ''}${tone ? ` chip--${tone}` : ''}`} onClick={onClick}>{children}</button>
);

export const Spacer = () => <span style={{ flex: 1 }} />;

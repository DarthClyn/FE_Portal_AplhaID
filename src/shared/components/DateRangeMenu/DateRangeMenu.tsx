import { useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { fmtDate } from '@/shared/services/format';
import { MenuDivider, MenuHeading, MenuItem, Popover } from '../Popover/Popover';
import './DateRangeMenu.css';

export interface RangePreset { id: string; label: string; since: () => number }
export type RangeValue = { preset: string } | { from: string; to: string };

const DAY = 86400_000;
export const daysAgo = (n: number) => () => Date.now() - n * DAY;
export const startOfYear = () => new Date(new Date().getFullYear(), 0, 1).getTime();
export const allTime = () => 0;

/** [start, end] in ms for a preset or a custom from/to (both dates inclusive). */
export function rangeBounds(v: RangeValue, presets: RangePreset[]): [number, number] {
  if ('preset' in v) return [presets.find((p) => p.id === v.preset)?.since() ?? 0, Infinity];
  return [Date.parse(`${v.from}T00:00:00`), Date.parse(`${v.to}T23:59:59.999`)];
}

const label = (v: RangeValue, presets: RangePreset[]) =>
  'preset' in v ? presets.find((p) => p.id === v.preset)?.label ?? '' : `${fmtDate(v.from)} – ${fmtDate(v.to)}`;

/** Date filter as in the Overview design: presets with a check, plus a custom range. */
export function DateRangeMenu({ value, presets, onChange, heading, prefix = '' }: {
  value: RangeValue; presets: RangePreset[]; onChange: (v: RangeValue) => void; heading: string; prefix?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState('from' in value ? value.from : today);
  const [to, setTo] = useState('to' in value ? value.to : today);
  const text = label(value, presets);
  return (
    <Popover width={240} trigger={({ open, toggle }) => (
      <button className={`range-btn${open ? ' range-btn--open' : ''}`} onClick={() => { setCustom(false); toggle(); }} aria-haspopup="menu">
        <CalendarDays size={15} />
        <span>{prefix}{'preset' in value ? text.charAt(0).toLowerCase() + text.slice(1) : text}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    )}>
      {(close) => (
        <>
          <MenuHeading>{heading}</MenuHeading>
          {presets.map((p) => {
            const on = 'preset' in value && value.preset === p.id;
            return (
              <MenuItem key={p.id} active={on} onClick={() => { onChange({ preset: p.id }); close(); }}>
                {p.label}{on && <Check size={15} />}
              </MenuItem>
            );
          })}
          <MenuDivider />
          {!custom ? (
            <MenuItem icon={<CalendarDays size={15} />} active={!('preset' in value)} onClick={() => setCustom(true)}>Custom range…</MenuItem>
          ) : (
            <div className="range-custom">
              <label>From<input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>To<input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
              <button className="btn btn--primary btn--sm btn--block" disabled={!from || !to || from > to}
                onClick={() => { onChange({ from, to }); close(); }}>Apply</button>
            </div>
          )}
        </>
      )}
    </Popover>
  );
}

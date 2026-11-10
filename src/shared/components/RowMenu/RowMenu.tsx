import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { MenuDivider, MenuItem, Popover } from '../Popover/Popover';
import './RowMenu.css';

export interface MenuItemDef { label: string; onClick: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean; title?: string; dividerBefore?: boolean }
export type { MenuItemDef as MenuItem };

/** "…" button with a menu of row actions. */
export function RowMenu({ items }: { items: MenuItemDef[] }) {
  return (
    <Popover width={230} trigger={({ toggle }) => (
      <button className="row-menu__btn" onClick={toggle} aria-label="Actions" aria-haspopup="menu"><MoreHorizontal size={18} /></button>
    )}>
      {(close) => items.map((i) => (
        <div key={i.label}>
          {i.dividerBefore && <MenuDivider />}
          <MenuItem icon={i.icon} danger={i.danger} disabled={i.disabled} title={i.title} onClick={() => { close(); i.onClick(); }}>{i.label}</MenuItem>
        </div>
      ))}
    </Popover>
  );
}

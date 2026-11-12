import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronsUpDown, FilePlus2, History, Inbox, LayoutGrid, LogOut, MousePointerClick, PlayCircle, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/demo/DemoProvider';
import { TestDocsToggle } from '@/test-docs/TestDocsToggle'; // test-docs
import { JURISDICTIONS, PORTAL } from '@/config/portal';
import { initials, useAuth } from '@/shared/services/auth';
import './AppShell.css';

const NAV = [
  { to: '/overview', label: 'Overview', icon: LayoutGrid, show: true },
  { to: '/issue', label: 'Issue eLC', icon: FilePlus2, show: PORTAL.features.issue },
  { to: '/inbox', label: 'Inbox', icon: Inbox, show: PORTAL.features.inbox },
  { to: '/verify', label: 'Verify eLC', icon: ShieldCheck, show: true },
  { to: '/audit', label: 'Audit log', icon: History, show: true },
];

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`shell${collapsed ? ' shell--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__logo" aria-hidden>α</span>
          <span className="brand__text">
            <span className="brand__name">
              {PORTAL.bank.name}
            </span>
            <span className="brand__sub">{JURISDICTIONS[PORTAL.bank.jurisdiction].name}</span>
          </span>
        </div>
        <nav className="nav">
          {NAV.filter((n) => n.show).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav__item${isActive ? ' nav__item--active' : ''}`} title={label}>
              <Icon size={17} strokeWidth={1.75} />
              <span className="nav__label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          <UserMenu />
          <div className="managed"><span className="dot" /> Managed by {PORTAL.managedBy}</div>
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const name = user?.name ?? '';
  return (
    <div className="user-wrap" ref={ref}>
      {open && (
        <div className="user-menu" role="menu">
          <div className="user-menu__who">Signed in as <strong>{user?.username}</strong></div>
          <div className="user-menu__label">Demo</div>
          <button role="menuitem" className="user-menu__item" onClick={() => { setOpen(false); demo.start('manual'); }}><MousePointerClick size={15} /> Guided demo (manual)</button>
          <button role="menuitem" className="user-menu__item" onClick={() => { setOpen(false); demo.start('auto'); }}><PlayCircle size={15} /> Auto demo</button>
          <TestDocsToggle />{/* test-docs */}
          <div className="user-menu__sep" />
          <button role="menuitem" className="user-menu__item" onClick={() => void logout()}><LogOut size={15} /> Sign out</button>
        </div>
      )}
      <button className="user" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className="user__avatar">{initials(name)}</span>
        <span className="user__text">
          <span className="user__name">{name}</span>
          <span className="user__role">{PORTAL.userRole}</span>
        </span>
        <ChevronsUpDown size={14} className="user__chev" />
      </button>
    </div>
  );
}

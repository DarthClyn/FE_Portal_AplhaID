// User menu item: switch test docs on or off.
import { FlaskConical } from 'lucide-react';
import { setTestDocs, useTestDocs } from './testDocs';
import './TestDocs.css';

export function TestDocsToggle() {
  const on = useTestDocs();
  return (
    <button role="menuitemcheckbox" aria-checked={on} className="user-menu__item test-docs-toggle" onClick={() => setTestDocs(!on)}>
      <FlaskConical size={15} /> Test docs
      <span className={`test-docs-switch${on ? ' test-docs-switch--on' : ''}`} aria-hidden><span /></span>
    </button>
  );
}

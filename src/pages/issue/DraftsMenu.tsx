import { useState } from 'react';
import { FileText, FolderOpen, Trash2 } from 'lucide-react';
import { Button, MenuDivider, MenuHeading, Popover } from '@/shared/components';
import { DRAFT_DAYS, deleteDraft, draftTime, listDrafts, type Draft } from '@/shared/services/drafts';

/** "Open draft": drafts saved in this browser, newest first. */
export function DraftsMenu({ currentId, onOpen, disabled }: { currentId: string | null; onOpen: (d: Draft) => void; disabled?: boolean }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  return (
    <Popover width={360} trigger={({ toggle }) => (
      <Button icon={<FolderOpen size={16} />} disabled={disabled} onClick={() => { setDrafts(listDrafts()); toggle(); }}>Open draft</Button>
    )}>
      {(close) => (
        <div className="drafts">
          <MenuHeading>Saved drafts</MenuHeading>
          {!drafts.length && <p className="drafts__empty">No saved drafts yet. Use Save draft to keep your work in this browser.</p>}
          {drafts.map((d) => {
            const f = d.form.fields;
            const sub = f.beneficiaryName || (d.origin === 'import' ? 'Imported from JSON' : 'No beneficiary yet');
            return (
              <div key={d.id} className={`drafts__item${d.id === currentId ? ' drafts__item--current' : ''}`}>
                <button className="drafts__open" onClick={() => { onOpen(d); close(); }}>
                  <span className="drafts__icon"><FileText size={15} /></span>
                  <span className="drafts__text"><strong>{f.lcNumber || 'Untitled draft'}</strong><span>{sub}</span></span>
                  <span className="drafts__time">{d.id === currentId ? 'open now' : draftTime(d.savedAt)}</span>
                </button>
                <button className="drafts__del" aria-label="Delete draft" title="Delete draft"
                  onClick={() => { deleteDraft(d.id); setDrafts(listDrafts()); }}><Trash2 size={14} /></button>
              </div>
            );
          })}
          <MenuDivider />
          <p className="drafts__foot">Saved in this browser only. Drafts are kept for {DRAFT_DAYS} days.</p>
        </div>
      )}
    </Popover>
  );
}

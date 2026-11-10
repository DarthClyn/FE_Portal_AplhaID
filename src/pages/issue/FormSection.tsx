import { FileText, Plus, Trash2 } from 'lucide-react';
import { partnerLabels } from '@/config/portal';
import { Field, FieldGrid, FileDrop, Segmented, Select, TextArea, TextInput } from '@/shared/components';
import { CURRENCIES, type ElcForm, type Errors, type FieldDef, type SectionDef } from '@/shared/services/elcModel';
import { fmtSize } from '@/shared/services/format';

export interface Attachment { filename: string; mimeType: string; data: string; size: number }

interface Props {
  section: SectionDef;
  form: ElcForm;
  errors: Errors;
  show: (key: string) => boolean;
  setField: (key: string, value: string) => void;
  touch: (key: string) => void;
  setDocs: (docs: ElcForm['docs']) => void;
  attachments: Attachment[];
  addFiles: (files: File[]) => void;
  removeAttachment: (i: number) => void;
}

/** The fields of one form section, laid out two per row like the design. */
export function FormSection(p: Props) {
  const { section, errors, show } = p;
  if (section.id === 'attachments') {
    return (
      <div className="attach">
        <FileDrop accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg" multiple onFiles={p.addFiles} hint="PDF, JPG or PNG · up to 10 MB in total" />
        {p.attachments.map((a, i) => (
          <div className="doc-row" key={a.filename + i}>
            <span className="doc-row__icon"><FileText size={16} /></span>
            <span className="grow"><strong>{a.filename}</strong><span className="tbl__sub">{a.mimeType.split('/')[1]?.toUpperCase()} · {fmtSize(a.size)}</span></span>
            <button className="icon-btn" onClick={() => p.removeAttachment(i)} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    );
  }
  return (
    <>
      {section.id === 'documents' && <DocsEditor {...p} />}
      <FieldGrid>
        {section.fields.map((fd) => (
          <Field key={fd.key} label={fd.label} tag={fd.tag} required={fd.required} wide={fd.wide} htmlFor={fd.key}
            error={show(fd.key) ? errors[fd.key] : undefined}>
            <Control fd={fd} {...p} />
          </Field>
        ))}
      </FieldGrid>
    </>
  );
}

function Control({ fd, form, setField, touch }: Props & { fd: FieldDef }) {
  const v = form.fields[fd.key] ?? '';
  const common = { id: fd.key, value: v, onBlur: () => touch(fd.key) };
  const set = (x: string) => setField(fd.key, x);
  if (fd.key === 'amount') {
    return (
      <div className="money">
        <select className="input money__cur" value={form.fields.currency ?? 'USD'} onChange={(e) => setField('currency', e.target.value)} aria-label="Currency">
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <TextInput {...common} inputMode="decimal" placeholder="0.00" onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, ''))} />
      </div>
    );
  }
  switch (fd.kind) {
    case 'readonly': return <TextInput {...common} readOnly />;
    case 'textarea': return <TextArea {...common} placeholder={fd.required ? '' : 'Optional'} onChange={(e) => set(e.target.value)} />;
    case 'date': return <TextInput {...common} type="date" onChange={(e) => set(e.target.value)} />;
    case 'segmented': return <Segmented id={fd.key} options={fd.options ?? []} value={v} onChange={(x) => { set(x); touch(fd.key); }} />;
    case 'select':
    case 'partner': {
      const options = fd.kind === 'partner' ? partnerLabels().map((l) => ({ value: l, label: l })) : (fd.options ?? []);
      const all = v && !options.some((o) => o.value === v) ? [...options, { value: v, label: v }] : options;
      return (
        <Select {...common} onChange={(e) => set(e.target.value)}>
          {!v && <option value="">Select…</option>}
          {all.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      );
    }
    default: return <TextInput {...common} placeholder={fd.required ? '' : 'Optional'} onChange={(e) => set(e.target.value)} />;
  }
}

function DocsEditor({ form, setDocs, errors, show }: Props) {
  const docs = form.docs;
  const update = (i: number, k: 'title' | 'detail', v: string) => setDocs(docs.map((d, n) => (n === i ? { ...d, [k]: v } : d)));
  return (
    <Field label="Documents required" tag="46A" required wide error={show('documentsRequired') ? errors.documentsRequired : undefined}>
      <div className="docs">
        {docs.map((d, i) => (
          <div className="doc-row" key={i}>
            <span className="doc-row__icon"><FileText size={16} /></span>
            <span className="doc-row__inputs">
              <input className="doc-row__title" value={d.title} placeholder="Document, e.g. Commercial invoice" onChange={(e) => update(i, 'title', e.target.value)} />
              <input className="doc-row__detail" value={d.detail} placeholder="Details, e.g. Signed · 3 copies" onChange={(e) => update(i, 'detail', e.target.value)} />
            </span>
            <button className="icon-btn" onClick={() => setDocs(docs.filter((_, n) => n !== i))} aria-label="Remove document"><Trash2 size={16} /></button>
          </div>
        ))}
        <button className="add-link" onClick={() => setDocs([...docs, { title: '', detail: '' }])}><Plus size={15} /> Add document</button>
      </div>
    </Field>
  );
}

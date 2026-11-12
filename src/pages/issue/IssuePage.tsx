import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Save, Send, Upload } from 'lucide-react';
import { PORTAL, bankLabel } from '@/config/portal';
import { Banner, Button, Card, Collapsible, FieldValues, Mark, PageHeader } from '@/shared/components';
import {
  SECTIONS, apiData, displayValue, emptyForm, formFromJson, requiredDone, sectionErrors, sectionSummary,
  validate, type ElcForm, type SectionId,
} from '@/shared/services/elcModel';
import { downloadJson, readBase64, readJson } from '@/shared/services/files';
import { fmtDateTime } from '@/shared/services/format';
import { ApiError } from '@/shared/services/http';
import { rememberSigned } from '@/shared/services/session';
import { deleteDraft, saveDraft, type Draft } from '@/shared/services/drafts';
import { DraftsMenu } from './DraftsMenu';
import { trustApi, type IssueResponse } from '@/shared/services/trustApi';
import { FormSection, type Attachment } from './FormSection';
import { SidePanel } from './SidePanel';
import { SendCard, advisingPartner, useSendElc } from './SendToAdvisingBank';
import { useDemo } from '@/demo/DemoProvider';
import { SigningModal } from '@/demo/SigningModal';
import { sampleElc } from '@/test-docs/sampleElc'; // test-docs
import { FillDetailsButton } from '@/test-docs/FillDetailsButton'; // test-docs
import './Issue.css';

const MAX_ATTACH = 10 * 1024 * 1024;
type Phase = 'edit' | 'signing' | 'failed' | 'issued';

export function IssuePage() {
  const [form, setForm] = useState<ElcForm>(emptyForm);
  const [open, setOpen] = useState<Partial<Record<SectionId, boolean>>>({ credit: true, parties: true, amount: true });
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [embedPdf, setEmbedPdf] = useState(true);
  const [phase, setPhase] = useState<Phase>('edit');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad' | 'info'; title: string; text?: string } | null>(null);
  const [issued, setIssued] = useState<IssueResponse | null>(null);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);
  const [trustedPartner, setTrustedPartner] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<Draft['origin']>('manual');
  const importInput = useRef<HTMLInputElement>(null);
  const demo = useDemo();
  const sendCtl = useSendElc(issued?.txId, issued?.vc);
  const sendTo = advisingPartner(issued?.vc);

  const errors = useMemo(() => validate(form), [form]);
  const done = requiredDone(errors);
  const issues = Object.keys(errors).filter((k) => attempted || touched.has(k)).length;
  const show = (k: string) => attempted || touched.has(k);

  // "Bank A · … is a trusted partner": registry answer for the bank the eLC is available with.
  useEffect(() => {
    const partner = PORTAL.partners.find((p) => bankLabel(p.name, p.jurisdiction) === form.fields.availableWith);
    if (!partner) { setTrustedPartner(null); return; }
    let live = true;
    trustApi.bankByBic(partner.bic).then(
      (r) => live && setTrustedPartner(r.data.isTrusted ? form.fields.availableWith : null),
      () => live && setTrustedPartner(null),
    );
    return () => { live = false; };
  }, [form.fields.availableWith]);

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, fields: { ...f.fields, [key]: value } }));
  const touch = (key: string) => setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));

  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const { form: next, ignored, count } = formFromJson(await readJson(file));
      setForm(next);
      setOrigin('import');
      setTouched(new Set());
      setAttempted(false);
      setNotice({ tone: 'info', title: `Imported ${count} field${count === 1 ? '' : 's'} from ${file.name}`, text: ignored.length ? `Not used: ${ignored.slice(0, 6).join(', ')}${ignored.length > 6 ? '…' : ''}` : 'Check each section, then sign.' });
    } catch (e) {
      setNotice({ tone: 'bad', title: 'Could not import this file', text: (e as Error).message });
    }
  };

  const fillSample = () => {
    setForm(sampleElc());
    setOrigin('manual');
    setTouched(new Set());
    setAttempted(false);
    setOpen({ credit: true, parties: true, amount: true });
    setNotice({ tone: 'ok', title: 'Sample details filled', text: `${PORTAL.bank.name} sample eLC with a new LC number. Check each section, then sign.` });
  };

  const addFiles = async (files: File[]) => {
    const used = attachments.reduce((n, a) => n + a.size, 0);
    const ok = files.filter((f) => /\.(pdf|jpe?g|png)$/i.test(f.name));
    const total = used + ok.reduce((n, f) => n + f.size, 0);
    if (ok.length < files.length) setNotice({ tone: 'bad', title: 'Only PDF, JPG or PNG files can be attached' });
    if (total > MAX_ATTACH) { setNotice({ tone: 'bad', title: 'Attachments are larger than 10 MB in total' }); return; }
    const added = await Promise.all(ok.map(async (f) => ({ filename: f.name, mimeType: f.type || 'application/octet-stream', size: f.size, data: await readBase64(f) })));
    setAttachments((a) => [...a, ...added]);
  };

  const saveCurrentDraft = () => {
    try {
      const { draft, withoutAttachments } = saveDraft({ id: draftId ?? undefined, origin, form, attachments, embedPdf });
      setDraftId(draft.id);
      const when = fmtDateTime(draft.savedAt).split(' · ')[1];
      setNotice({
        tone: 'ok', title: 'Draft saved',
        text: `${form.fields.lcNumber || 'Untitled draft'} · ${when}. Open it later from Open draft.${withoutAttachments ? ' Attachments were too large to keep in the browser; add them again before signing.' : ''}`,
      });
    } catch (e) {
      setNotice({ tone: 'bad', title: 'Could not save the draft', text: (e as Error).message });
    }
  };

  const openDraft = (d: Draft) => {
    setForm(d.form);
    setAttachments(d.attachments);
    setEmbedPdf(d.embedPdf);
    setOrigin(d.origin);
    setDraftId(d.id);
    setTouched(new Set());
    setAttempted(false);
    setPhase('edit');
    setOpen({ credit: true, parties: true, amount: true });
    setNotice({ tone: 'info', title: `Opened draft ${d.form.fields.lcNumber || 'Untitled draft'}`, text: 'Changes are not saved until you click Save draft.' });
  };

  const sign = async () => {
    if (Object.keys(errors).length) {
      setAttempted(true);
      setOpen((o) => ({ ...o, ...Object.fromEntries(SECTIONS.filter((s) => sectionErrors(s, errors).length).map((s) => [s.id, true])) }));
      return;
    }
    setPhase('signing');
    setNotice(null);
    try {
      const files = attachments.map(({ filename, mimeType, data }) => ({ filename, mimeType, data }));
      if (embedPdf) {
        const { elcPdfBase64 } = await import('@/shared/services/pdf');
        files.push({ filename: `${form.fields.lcNumber}.pdf`, mimeType: 'application/pdf', data: elcPdfBase64(form) });
      }
      // Keep the signing pop-up up long enough to read, even when the API answers quickly.
      const [r] = await Promise.all([trustApi.issueElc({ data: apiData(form), attachments: files }), new Promise((ok) => setTimeout(ok, 2200))]);
      rememberSigned(r.data.vc);
      if (draftId) { deleteDraft(draftId); setDraftId(null); }
      setIssued(r.data);
      setIssuedAt(new Date().toISOString());
      setPhase('issued');
      setOpen({});
      window.scrollTo({ top: 0 });
    } catch (e) {
      const err = e as ApiError;
      setPhase('failed');
      setNotice({
        tone: 'bad', title: "Couldn't sign this eLC",
        text: err.isUnavailable ? "The signing service didn't respond. Your details are kept, so you can try again." : `${err.message}. Your details are kept.`,
      });
    }
  };

  const reset = () => {
    setForm(emptyForm()); setAttachments([]); setTouched(new Set()); setAttempted(false);
    setPhase('edit'); setIssued(null); setNotice(null); setDraftId(null); setOrigin('manual'); setOpen({ credit: true, parties: true, amount: true });
  };

  const isIssued = phase === 'issued' && issued;

  return (
    <>
      <PageHeader
        title={isIssued ? 'eLC issued' : 'Issue eLC'}
        actions={isIssued ? (
          <>
            {sendTo && (sendCtl.state.kind === 'idle' || sendCtl.state.kind === 'error') && (
              <Button variant="primary" icon={<Send size={16} />} onClick={() => void sendCtl.send()}>Send to {sendTo.name}</Button>
            )}
            <Button data-tour="download-elc" icon={<Download size={16} />} onClick={() => downloadJson(issued.vc, `${form.fields.lcNumber || issued.txId}.json`)}>Download signed eLC</Button>
            <Button icon={<Plus size={16} />} onClick={reset}>Issue another eLC</Button>
          </>
        ) : (
          <>
            <FillDetailsButton onFill={fillSample} force={!!demo.mode} disabled={phase === 'signing'} />{/* test-docs */}
            <DraftsMenu currentId={draftId} onOpen={openDraft} disabled={phase === 'signing'} />
            <Button icon={<Save size={16} />} onClick={saveCurrentDraft} disabled={phase === 'signing'}>Save draft</Button>
            <Button variant="primary" icon={<Upload size={16} />} onClick={() => importInput.current?.click()} disabled={phase === 'signing'}>Import JSON</Button>
            <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={(e) => { void importJson(e.target.files?.[0]); e.target.value = ''; }} />
          </>
        )}
      />
      {isIssued && (
        <Banner tone="ok" title={`eLC issued · ${form.fields.lcNumber} is now Active`}>
          Signed with {PORTAL.bank.name}'s key and saved to Overview.
        </Banner>
      )}
      {notice && !isIssued && <Banner tone={notice.tone} title={notice.title} onClose={() => setNotice(null)}>{notice.text}</Banner>}
      {phase === 'signing' && <SigningModal />}
      <div className="page-grid">
        <Card padded={false} className={phase === 'signing' ? 'is-busy' : ''} data-tour="issue-form">
          {SECTIONS.map((s) => {
            const errs = sectionErrors(s, errors);
            const shown = errs.filter(show);
            const complete = !errs.length && (!s.optional || !!sectionSummary(s.id, form, attachments.length));
            const aside = shown.length
              ? <span className="sec-issue"><Mark state="fail" size={14} /> {shown.length === 1 && errors[shown[0]] === 'Required' ? '1 field missing' : `${shown.length} issue${shown.length === 1 ? '' : 's'}`}</span>
              : complete && !s.optional ? <Mark state="pass" size={20} /> : s.optional ? <span>Optional</span> : null;
            return (
              <Collapsible key={s.id} title={s.title} summary={sectionSummary(s.id, form, attachments.length)} aside={aside}
                open={!!open[s.id]} onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>
                {isIssued ? <IssuedValues id={s.id} form={form} attachments={attachments} /> : (
                  <FormSection section={s} form={form} errors={errors} show={show} setField={setField} touch={touch}
                    setDocs={(docs) => setForm((f) => ({ ...f, docs }))} attachments={attachments} addFiles={(f) => void addFiles(f)}
                    removeAttachment={(i) => setAttachments((a) => a.filter((_, n) => n !== i))} />
                )}
              </Collapsible>
            );
          })}
        </Card>
        <SidePanel form={form} done={done} issues={issues} showIssues={attempted || issues > 0} embedPdf={embedPdf} setEmbedPdf={setEmbedPdf}
          phase={phase} onSign={() => void sign()} issued={issued} issuedAt={issuedAt} trustedPartner={trustedPartner}
          sendCard={isIssued ? <SendCard vc={issued.vc} ctl={sendCtl} /> : null} />
      </div>
    </>
  );
}

function IssuedValues({ id, form, attachments }: { id: SectionId; form: ElcForm; attachments: Attachment[] }) {
  if (id === 'attachments') return <span className="muted">{attachments.map((a) => a.filename).join(', ') || 'No attachments'}</span>;
  const s = SECTIONS.find((x) => x.id === id)!;
  const rows = s.fields.filter((f) => form.fields[f.key]).map((f) => ({ label: f.label, tag: f.tag, value: displayValue(f.key, form), wide: f.wide }));
  if (id === 'documents') rows.unshift({ label: 'Documents required', tag: '46A', value: form.docs.map((d) => `${d.title}${d.detail ? ` — ${d.detail}` : ''}`).join('\n'), wide: true });
  return <FieldValues rows={rows} />;
}

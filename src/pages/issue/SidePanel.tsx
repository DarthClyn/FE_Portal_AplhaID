import { CheckCircle2, List, ShieldCheck, Signature } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Checkbox, ElcSummaryCard, KeyValue, Mark } from '@/shared/components';
import { REQUIRED_KEYS, type ElcForm } from '@/shared/services/elcModel';
import { fmtDateTime } from '@/shared/services/format';
import type { IssueResponse } from '@/shared/services/trustApi';

interface Props {
  form: ElcForm;
  done: number;
  issues: number;
  showIssues: boolean;
  embedPdf: boolean;
  setEmbedPdf: (v: boolean) => void;
  phase: 'edit' | 'signing' | 'failed' | 'issued';
  onSign: () => void;
  issued: IssueResponse | null;
  issuedAt: string | null;
  trustedPartner: string | null;
}

export function SidePanel(p: Props) {
  const navigate = useNavigate();
  const total = REQUIRED_KEYS.length;
  const ready = p.done === total;
  if (p.phase === 'issued' && p.issued) {
    return (
      <div className="sticky">
        <ElcSummaryCard form={p.form} />
        <Card>
          <div className="ready">
            <span className="ready__title"><Mark state="pass" size={18} /> Issued · Active</span>
            <span className="muted">{fmtDateTime(p.issuedAt)}</span>
          </div>
          <div className="progress"><span style={{ width: '100%' }} /></div>
          <KeyValue rows={[{ label: 'Tx ID', value: <span className="mono">{p.issued.txId}</span> }]} />
          <Button variant="primary" size="lg" block icon={<List size={18} />} className="side-cta" onClick={() => navigate(`/overview/${encodeURIComponent(p.issued!.vcId)}`)}>View in Overview</Button>
          <p className="side-note muted">{p.embedPdf ? 'PDF copy embedded · ' : ''}recorded in Audit log</p>
        </Card>
      </div>
    );
  }
  const showBad = p.showIssues && p.issues > 0;
  return (
    <div className="sticky">
      <ElcSummaryCard form={p.form} />
      <Card>
        <div className="ready">
          {showBad
            ? <span className="ready__title ready__title--bad"><Mark state="fail" size={18} /> {p.issues} field{p.issues === 1 ? '' : 's'} need{p.issues === 1 ? 's' : ''} attention</span>
            : <span className={`ready__title${ready ? ' ready__title--ok' : ''}`}>{ready ? <Mark state="pass" size={18} /> : <CheckCircle2 size={18} className="faint" />} {ready ? 'Ready to issue' : 'Fill the required fields'}</span>}
          <span className={ready ? 'ready__count--ok' : 'muted'}>{p.done} / {total} required</span>
        </div>
        <div className={`progress${showBad ? ' progress--warn' : ''}`}><span style={{ width: `${(p.done / total) * 100}%` }} /></div>
        <KeyValue rows={[{ label: 'Format', value: 'W3C credential' }]} />
        <div className="side-check"><Checkbox label="Embed a PDF copy" checked={p.embedPdf} onChange={(e) => p.setEmbedPdf(e.target.checked)} /></div>
        <Button variant="primary" size="lg" block className="side-cta" icon={<Signature size={18} />}
          loading={p.phase === 'signing'} disabled={showBad} onClick={p.onSign}>
          {p.phase === 'signing' ? 'Signing…' : p.phase === 'failed' ? 'Try again' : 'Sign & issue eLC'}
        </Button>
        {showBad
          ? <p className="side-note muted">Fix the highlighted fields to sign</p>
          : p.trustedPartner && <p className="side-note side-note--ok"><ShieldCheck size={14} /> {p.trustedPartner} is a trusted partner</p>}
      </Card>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download } from 'lucide-react';
import {
  Banner, Button, Card, CopyId, ElcReadOnly, FileDrop, KeyValue, PageHeader, Spinner, StatusPill,
} from '@/shared/components';
import { toEvent } from '@/shared/services/auditEvents';
import { formFromVc } from '@/shared/services/elcModel';
import { downloadJson, readJson } from '@/shared/services/files';
import { daysUntil, fmtDate, fmtDateTime } from '@/shared/services/format';
import { rememberSigned, signedElc } from '@/shared/services/session';
import { lookupBank, trustApi } from '@/shared/services/trustApi';
import { useAsync } from '@/shared/services/useAsync';
import './ElcDetail.css';

/** One eLC: its record (IDs, status, dates), activity from the audit log, and read-only details when the signed file is at hand. */
export function ElcDetailPage() {
  const vcId = decodeURIComponent(useParams().vcId ?? '');
  const rec = useAsync(async () => {
    const r = (await trustApi.getVc(vcId)).data;
    const issuer = await lookupBank(r.issuerDid);
    return { ...r, issuerName: issuer?.name ?? null };
  }, [vcId]);
  const activity = useAsync(() => trustApi.audit(500).then((r) => r.data.lines.map(toEvent).filter((e) => e.vcId === vcId || (rec.data && e.txId === rec.data.txId))), [vcId, rec.data?.txId]);
  const [vc, setVc] = useState<Record<string, unknown> | null>(() => signedElc(vcId));
  const [fileError, setFileError] = useState<string | null>(null);

  const form = useMemo(() => (vc ? formFromVc(vc) : null), [vc]);
  const attachments = (vc?.credentialSubject as { attachments?: { filename: string; mimeType?: string }[] } | undefined)?.attachments
    ?? (vc?.attachments as { filename: string; mimeType?: string }[] | undefined) ?? [];

  const loadFile = async (files: File[]) => {
    setFileError(null);
    try {
      const v = (await readJson(files[0])) as Record<string, unknown>;
      if (v.id !== vcId) { setFileError('This file is a different eLC (its VC ID does not match this record).'); return; }
      rememberSigned(v);
      setVc(v);
    } catch (e) {
      setFileError((e as Error).message);
    }
  };

  if (rec.loading && !rec.data) return <div className="row gap-12"><Spinner /> Loading eLC…</div>;
  if (rec.error || !rec.data) {
    return (
      <>
        <PageHeader title="eLC not found" back={<Link to="/overview" className="detail-back"><ArrowLeft size={14} /> Back to Overview</Link>} />
        <Banner tone="bad" title="This eLC is not on record">{rec.error?.message}</Banner>
      </>
    );
  }
  const r = rec.data;
  const left = r.validUntil ? daysUntil(r.validUntil) : null;
  const title = form?.fields.lcNumber || r.txId;

  return (
    <>
      <PageHeader
        back={<Link to="/overview" className="detail-back"><ArrowLeft size={14} /> Back to Overview</Link>}
        title={title}
        subtitle={`Issued ${fmtDate(r.createdAt)}${r.issuerName ? ` by ${r.issuerName}` : ''} · ${r.validUntil ? `expires ${fmtDate(r.validUntil)}${left != null && left >= 0 ? ` (in ${left} days)` : ''}` : 'no expiry'}`}
        actions={
          <>
            {vc && <Button variant="primary" icon={<Download size={16} />} onClick={() => downloadJson(vc, `${title}.json`)}>Download signed eLC</Button>}
          </>
        }
      />
      {fileError && <Banner tone="bad" title={fileError} onClose={() => setFileError(null)} />}
      <div className="page-grid">
        <div>
          <Banner tone="lock" title="eLC details · read-only">
            {form ? "Open a section to review it. Issued eLCs can't be edited; changes need an amendment."
              : 'The portal stores IDs and status only, not the eLC itself. Open the signed eLC file to see its details.'}
          </Banner>
          {form ? <ElcReadOnly form={form} attachments={attachments} /> : (
            <FileDrop large accept=".json,application/json" onFiles={(f) => void loadFile(f)}
              title={<>Drop the signed eLC file or <span className="drop__link">browse</span></>}
              hint="It stays in this browser; only its VC ID is compared with this record." />
          )}
        </div>
        <div className="sticky">
          <Card>
            <div className="elc-summary__head"><strong>{title}</strong><StatusPill status={r.status} solid={r.status === 'active'} /></div>
            <KeyValue rows={[
              ...(form ? [{ label: 'Beneficiary', value: form.fields.beneficiaryName || '—' }] : []),
              { label: 'Issuer', value: r.issuerName ?? <CopyId value={r.issuerDid} /> },
              { label: 'Issued', value: fmtDate(r.createdAt) },
              { label: 'Expires', value: fmtDate(r.validUntil) },
            ]} />
            <KeyValue divider rows={[
              { label: 'Tx ID', value: <CopyId value={r.txId} full /> },
              { label: 'VC ID', value: <CopyId value={r.vcId} /> },
              ...(r.status === 'suspended' ? [{ label: 'Suspended', value: `${fmtDate(r.updatedAt)}${r.reason ? ` · ${r.reason}` : ''}` }] : []),
            ]} />
          </Card>
          <Card>
            <h3 className="card-h">Activity</h3>
            {activity.loading && !activity.data ? <div className="row gap-8 muted" style={{ marginTop: 12 }}><Spinner size={14} /> Loading…</div> : (
              <ul className="activity">
                {(activity.data ?? []).slice(0, 5).map((e) => (
                  <li key={e.key}>
                    <span className={`activity__dot activity__dot--${e.result?.tone === 'bad' ? 'bad' : e.category === 'issuing' ? 'ok' : 'info'}`} />
                    <span><strong>{e.label}</strong><span className="tbl__sub">{e.result?.text ?? e.code} · {e.by}</span></span>
                    <span className="activity__time">{fmtDateTime(e.time)}</span>
                  </li>
                ))}
                {!activity.data?.length && <li className="muted" style={{ display: 'block' }}>No recorded activity yet.</li>}
              </ul>
            )}
            <Link to={`/audit?q=${encodeURIComponent(r.txId)}`} className="detail-back" style={{ marginTop: 14 }}>See all in Audit log <ArrowRight size={14} /></Link>
          </Card>
        </div>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { BadgeCheck, CalendarCheck, Download, FileJson, Fingerprint, Lock, PenLine, Upload } from 'lucide-react';
import { PORTAL } from '@/config/portal';
import {
  Button, Card, CopyId, FileDrop, KeyValue, Mark, PageHeader, Spinner, StatusPill, WithFlag,
} from '@/shared/components';
import { downloadJson } from '@/shared/services/files';
import { fmtDate, fmtDateTime } from '@/shared/services/format';
import { takeVerifyHandoff } from '@/shared/services/session';
import {
  looksLikeJwt, looksLikeVc, parseCredentialText, verifyCredential, type Check, type Verification,
} from '@/shared/services/verification';
import './Verify.css';

type State =
  | { kind: 'idle'; error?: string }
  | { kind: 'checking'; fileName: string }
  | { kind: 'done'; fileName: string; result: Verification };

export function VerifyPage() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [open, setOpen] = useState<Record<string, boolean>>({ integrity: true });

  const run = async (vc: unknown, fileName: string) => {
    if (!looksLikeVc(vc) && !looksLikeJwt(vc)) {
      setState({ kind: 'idle', error: `${fileName} is not a signed credential (a W3C credential with a proof, or a VC-JWT).` });
      return;
    }
    setState({ kind: 'checking', fileName });
    const result = await verifyCredential(vc);
    setOpen(Object.fromEntries(result.checks.map((c) => [c.id, c.state !== 'pass'])) as Record<string, boolean>);
    if (result.checks.every((c) => c.state === 'pass')) setOpen({ integrity: true });
    setState({ kind: 'done', fileName, result });
  };

  useEffect(() => {
    const h = takeVerifyHandoff();
    if (h) void run(h.vc, h.fileName);
  }, []);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    try {
      await run(parseCredentialText(await f.text(), f.name), f.name);
    } catch (e) {
      setState({ kind: 'idle', error: (e as Error).message });
    }
  };

  const reset = () => setState({ kind: 'idle' });

  return (
    <>
      <PageHeader
        title="Verify eLC"
        actions={state.kind === 'done' && (
          <>
            <Button icon={<Download size={16} />} onClick={() => downloadJson(report(state.result, state.fileName), `verification-${state.result.ref}.json`)}>Download report</Button>
            <Button variant="primary" icon={<Upload size={16} />} onClick={reset}>Verify another eLC</Button>
          </>
        )}
      />
      {state.kind === 'idle' ? (
        <div className="page-grid">
          <Card className="verify-upload">
            <div className="verify-upload__head">
              <h2>Upload a signed eLC</h2>
              <p>JSON (W3C credential) or VC-JWT. You can also open one from the Inbox.</p>
            </div>
            <FileDrop large accept=".json,.jwt,.txt,application/json" onFiles={onFiles}
              title={<>Drop the file here or <span className="drop__link">browse</span></>}
              hint=".json · .jwt" />
            {state.error && (
              <div className="verify-error" role="alert">
                <strong>This file can't be verified</strong>
                <span>{state.error}</span>
              </div>
            )}
            <p className="verify-note"><Lock size={13} /> The file is used only for this check and is never stored. Only the result is recorded.</p>
          </Card>
          <div className="sticky">
            <Card>
              <h3 className="verify-side__title">What we check</h3>
              <ul className="verify-steps">
                {STEPS.map((x) => (
                  <li key={x.title}>
                    <span className="verify-steps__icon">{x.icon}</span>
                    <span><strong>{x.title}</strong><span>{x.text}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3 className="verify-side__title">Who checks it</h3>
              <div className="verify-route">
                <span className="via via--totm">TOTM</span>
                <span>Issued by a bank in the TOTM issuer registry: checked by the TOTM Trust API.</span>
              </div>
              <div className="verify-route">
                <span className="via via--pila">{PORTAL.externalPlatform.name}</span>
                <span>Any other issuer: checked with {PORTAL.externalPlatform.name}'s SDK and NDAKey.</span>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="page-grid">
          <Card padded={false}>
            <div className="checks__head">
              <h2>Verification checks</h2>
              <span className="checks__file">{state.kind === 'done' && <span className={`via via--${state.result.platform.toLowerCase()}`}>via {state.result.platform}</span>}<FileJson size={14} /> {state.fileName}</span>
            </div>
            {(state.kind === 'checking' ? PENDING : state.result.checks).map((c) => (
              <CheckRow key={c.id} check={c} pending={state.kind === 'checking'} open={!!open[c.id]}
                onToggle={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))} />
            ))}
            <div className="checks__foot"><Lock size={13} /> Only the result is stored. The eLC content is checked, never kept.</div>
          </Card>
          <div className="sticky">
            {state.kind === 'checking' ? (
              <Card><div className="verdict verdict--wait"><Spinner size={22} /><div className="verdict__text"><strong>Checking…</strong><span>Asking the issuer registry and status service.</span></div></div></Card>
            ) : <ResultCard r={state.result} />}
          </div>
        </div>
      )}
    </>
  );
}

const STEPS = [
  { icon: <Fingerprint size={16} />, title: 'Integrity', text: 'Nothing changed since it was signed' },
  { icon: <CalendarCheck size={16} />, title: 'Status', text: 'Active today: not expired, revoked or replaced' },
  { icon: <PenLine size={16} />, title: 'Issuer', text: 'Signed by the issuer it names' },
  { icon: <BadgeCheck size={16} />, title: 'Trusted issuer', text: 'That issuer is on the trusted list' },
];

const PENDING: Check[] = [
  { id: 'integrity', title: 'Integrity', question: 'Unchanged since signing?', state: 'error', detail: [] },
  { id: 'status', title: 'Status', question: 'Still valid today?', state: 'error', detail: [] },
  { id: 'issuer', title: 'Issuer', question: 'Who signed it?', state: 'error', detail: [] },
  { id: 'trusted', title: 'Trusted issuer', question: 'Allowed to issue eLCs?', state: 'error', detail: [] },
];

const PILL = { pass: ['Passed', 'ok'], fail: ['Failed', 'bad'], error: ['Not checked', 'warn'] } as const;

function CheckRow({ check, pending, open, onToggle }: { check: Check; pending: boolean; open: boolean; onToggle: () => void }) {
  const [text, tone] = PILL[check.state];
  return (
    <div className="check">
      <button className="check__head" onClick={onToggle} disabled={pending} aria-expanded={open}>
        {pending ? <Spinner size={20} /> : <Mark state={check.state} size={22} />}
        <span className="check__title">{check.title}</span>
        <span className="check__q">{check.question}</span>
        <span className="grow" />
        {!pending && <StatusPill status={text} tone={tone} dot={false} />}
        {!pending && <span className={`check__chev${open ? ' check__chev--open' : ''}`} />}
      </button>
      {open && !pending && (
        <div className="check__body">
          <ul className="check__detail">
            {check.detail.map((d) => (
              <li key={d.text} className={`check__item check__item--${d.state}`}><Mark state={d.state} size={15} /> {d.text}</li>
            ))}
          </ul>
          {!!check.facts?.length && (
            <dl className="check__facts">
              {check.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd className={f.mono ? 'mono' : ''}>{f.copy ? <CopyId value={f.value} head={14} tail={8} /> : f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

const reason = (r: Verification) => {
  const failed = r.checks.find((c) => c.state === 'fail');
  if (!failed) return '';
  if (failed.id === 'integrity') return 'changed after signing';
  if (failed.id === 'status') return r.status === 'not_found' ? 'not on record' : r.status ?? 'not valid today';
  if (failed.id === 'issuer') return 'signature does not match the issuer';
  return 'issuer not trusted';
};

function ResultCard({ r }: { r: Verification }) {
  const f = r.fields;
  const issuerName = r.issuerName;
  const j = r.issuerJurisdiction;
  const title = String(f.lcNumber ?? f.legalName ?? 'Credential');
  const party = f.beneficiaryName ?? f.legalName;
  const noun = f.lcNumber ? 'eLC' : 'credential';
  const who = r.platform === 'TOTM' && r.issuerName !== r.issuerDid ? issuerName : 'the issuer';
  const head = r.overall === 'pass'
    ? { title: `Verified · this ${noun} is genuine`, sub: 'All 4 checks passed. Safe to rely on.' }
    : r.overall === 'fail'
      ? { title: `Not verified · ${reason(r)}`, sub: `Don't rely on this ${noun}. Ask ${who} for a new copy.` }
      : { title: 'Could not confirm', sub: 'A check could not be completed. Treat as not verified and try again.' };
  const pill = r.overall === 'pass' ? (r.status ?? 'active') : r.overall === 'fail' ? (r.checks[0].state === 'fail' ? 'Untrusted' : r.status ?? 'Failed') : 'Not checked';
  return (
    <Card padded={false} className={`result result--${r.overall}`}>
      <div className="result__top">
        <div className="verdict">
          <Mark state={r.overall} size={40} />
          <div className="verdict__text"><strong>{head.title}</strong><span>{head.sub}</span></div>
        </div>
        <div className="result__meta"><span>Checked <b>{fmtDateTime(r.checkedAt)}</b></span><span>Ref. <b>{r.ref}</b></span></div>
      </div>
      <div className="result__body">
        <div className="result__lc">
          <strong>{title}</strong>
          <StatusPill status={pill} tone={r.overall === 'pass' ? 'ok' : r.overall === 'fail' ? 'bad' : 'warn'} dot={false} />
        </div>
        <KeyValue rows={[
          ...(party ? [{ label: f.beneficiaryName ? 'Beneficiary' : 'Holder', value: String(party) }] : []),
          { label: 'Issued by', value: <WithFlag j={j}><span title={r.issuerDid ?? ''}>{issuerName}</span></WithFlag> },
          ...(f.expiryDate ? [{ label: 'Expires', value: fmtDate(String(f.expiryDate)) }] : []),
          { label: 'Verified with', value: r.platform === 'PILA' ? 'PILA SDK + NDAKey' : 'TOTM Trust API' },
        ]} />
        <KeyValue divider rows={[
          ...(r.platform === 'TOTM' ? [{ label: 'Tx ID', value: <CopyId value={r.txId} full /> }] : []),
          { label: 'VC ID', value: <CopyId value={r.vcId} /> },
        ]} />
        {r.overall === 'fail' && r.checks[0].state === 'fail' && (
          <p className="result__warn">These details can't be trusted. The file was changed after {who} signed it.</p>
        )}
      </div>
    </Card>
  );
}

/** Report download: results and IDs only (no eLC content beyond its number). */
const report = (r: Verification, fileName: string) => ({
  ref: r.ref, checkedAt: r.checkedAt, file: fileName, result: r.overall,
  platform: r.platform, lcNumber: r.fields.lcNumber ?? null, vcId: r.vcId, txId: r.txId, issuerDid: r.issuerDid, issuerName: r.issuerName,
  status: r.status, checks: r.checks.map((c) => ({ check: c.title, result: c.state, details: c.detail.map((d) => d.text) })),
});

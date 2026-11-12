// Send an issued eLC to its advising bank. The advising bank is the partner named in the eLC (Available with, 41a);
// for a partner on PILA (Bank Beta VN) it goes to Bank Beta's inbox through the TOTM Trust API. No bank to pick:
// the eLC already says who it is for.
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, RefreshCw, Send, XCircle } from 'lucide-react';
import { JURISDICTIONS, bankLabel, partnerByBic } from '@/config/portal';
import { Button, Card, CopyId, StatusPill, WithFlag } from '@/shared/components';
import { fmtDateTime } from '@/shared/services/format';
import { trustApi, type ElcSent } from '@/shared/services/trustApi';

/** The partner bank an eLC is for (its advisingBankBic), when that bank has an inbox we can send to. */
export function advisingPartner(vc: Record<string, unknown> | null | undefined) {
  const bic = (vc?.credentialSubject as Record<string, unknown> | undefined)?.advisingBankBic;
  const p = partnerByBic(typeof bic === 'string' ? bic : null);
  return p?.platform ? p : null;
}

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; sent: ElcSent; checking?: boolean; note?: string }
  | { kind: 'error'; message: string };

/** Send state for one eLC; `initial` is the record's earlier send, if any. */
export function useSendElc(txId: string | null | undefined, vc: Record<string, unknown> | null | undefined, initial?: ElcSent | null) {
  const [state, setState] = useState<State>(initial ? { kind: 'sent', sent: initial } : { kind: 'idle' });
  // A different eLC (or its stored send) starts fresh.
  useEffect(() => { setState(initial ? { kind: 'sent', sent: initial } : { kind: 'idle' }); }, [txId, initial]);

  const send = useCallback(async () => {
    if (!txId || !vc) return;
    setState({ kind: 'sending' });
    try {
      const r = await trustApi.sendElc(txId, vc);
      setState({ kind: 'sent', sent: r.data });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }, [txId, vc]);

  const check = useCallback(async () => {
    if (!txId || state.kind !== 'sent') return;
    const sent = state.sent;
    setState({ kind: 'sent', sent, checking: true });
    try {
      const r = (await trustApi.sendResult(txId)).data;
      setState(r.available
        ? { kind: 'sent', sent: { ...sent, status: r.status, decision: r.decision ?? null, reasons: r.reasons ?? [] } }
        : { kind: 'sent', sent, note: 'No result yet. PILA opens its result lookup in its next release.' });
    } catch (e) {
      setState({ kind: 'sent', sent, note: (e as Error).message });
    }
  }, [txId, state]);

  return { state, send, check };
}

export type SendElc = ReturnType<typeof useSendElc>;

const STATUS_TEXT: Record<string, string> = {
  RECEIVED: 'Received, waiting for verification',
  PROCESSING: 'Being verified',
  IGNORED: 'Ignored: already received',
};

/** Side-panel card: who the eLC goes to, the Send button, then the send status and the bank's result. */
export function SendCard({ vc, ctl, sentTo }: { vc: Record<string, unknown> | null | undefined; ctl: SendElc; sentTo?: string }) {
  // Without the signed file, an earlier send can still be shown (its bank comes from the record).
  const partner = advisingPartner(vc) ?? (sentTo ? partnerByBic(sentTo) : null);
  if (!partner) return null;
  const { state, send, check } = ctl;
  const sent = state.kind === 'sent' ? state.sent : null;
  const decided = sent?.status === 'CONCLUDED' && sent.decision;
  return (
    <Card className="send-card" data-tour="send-card">
      <div className="send-card__head">
        <h3>Send to advising bank</h3>
        {sent && <StatusPill status={decided ? (sent.decision === 'PASS' ? 'Verified' : 'Rejected') : 'Sent'} tone={decided ? (sent.decision === 'PASS' ? 'ok' : 'bad') : 'info'} dot={false} />}
      </div>
      <div className="send-card__to">
        <WithFlag j={JURISDICTIONS[partner.jurisdiction]}><strong>{bankLabel(partner.name, partner.jurisdiction)}</strong></WithFlag>
        <span className="muted">{partner.bic} · via {partner.platform} · named in this eLC</span>
      </div>

      {!vc && state.kind !== 'sent' ? null : state.kind === 'idle' || state.kind === 'sending' || state.kind === 'error' ? (
        <>
          {state.kind === 'error' && <p className="send-card__error"><XCircle size={14} /> {state.message}</p>}
          <Button variant="primary" block icon={<Send size={16} />} loading={state.kind === 'sending'} onClick={() => void send()} data-tour="send-elc">
            {state.kind === 'error' ? 'Try again' : `Send to ${partner.name}`}
          </Button>
        </>
      ) : sent && (
        <>
          <ul className="send-card__steps">
            <li className="done"><CheckCircle2 size={15} /> Sent {fmtDateTime(sent.at)}</li>
            <li className={decided ? (sent.decision === 'PASS' ? 'done' : 'bad') : 'wait'}>
              {decided ? (sent.decision === 'PASS' ? <CheckCircle2 size={15} /> : <XCircle size={15} />) : <Clock size={15} />}
              {decided
                ? sent.decision === 'PASS' ? `${partner.name} verified it: PASS` : `${partner.name} rejected it: ${(sent.reasons ?? []).join(', ') || 'FAIL'}`
                : STATUS_TEXT[sent.status] ?? sent.status}
            </li>
          </ul>
          {sent.pilaRequestId && <div className="send-card__ref"><span className="muted">PILA request ID</span><CopyId value={sent.pilaRequestId} head={8} tail={6} /></div>}
          {state.kind === 'sent' && state.note && <p className="send-card__note muted">{state.note}</p>}
          {!decided && <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} loading={state.kind === 'sent' && state.checking} onClick={() => void check()}>Check result</Button>}
        </>
      )}
    </Card>
  );
}

// Pop-up shown while an eLC is being signed: makes clear the bank's own DID key signs it.
import { useEffect, useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { PORTAL } from '@/config/portal';
import { trustApi } from '@/shared/services/trustApi';
import './Demo.css';

const STAGES = ['Build the W3C credential from the form', "Sign with the bank's key (ecdsa-sd-2023)", 'Record it as Active in the registry'];

export function SigningModal() {
  const [did, setDid] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    let live = true;
    trustApi.bankByBic(PORTAL.bank.bic).then((r) => live && setDid(r.data.did), () => undefined);
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 650);
    return () => { live = false; clearInterval(t); };
  }, []);
  return (
    <div className="sign-modal" role="alertdialog" aria-live="assertive" aria-label="Signing">
      <div className="sign-modal__card">
        <div className="sign-modal__icon"><KeyRound size={24} /></div>
        <h3>Signing using your bank's DID</h3>
        <p>{PORTAL.bank.name} signs this eLC with its own key. Anyone can check the signature against this DID.</p>
        <div className="sign-modal__did"><span>Issuer DID</span><code>{did ?? 'Looking up…'}</code></div>
        <ul className="sign-modal__steps">
          {STAGES.map((s, i) => (
            <li key={s} className={i < stage ? 'done' : i === stage ? 'on' : ''}>
              {i < stage ? <Check size={14} /> : <span style={{ width: 14, textAlign: 'center' }}>{i + 1}</span>} {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

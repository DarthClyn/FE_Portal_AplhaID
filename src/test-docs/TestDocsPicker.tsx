// Verify page card: pick a sample eLC and verify it (shown while Test docs is on).
import { useState } from 'react';
import { FileJson, FileKey2, FlaskConical, ShieldCheck } from 'lucide-react';
import { Button, Card, Spinner } from '@/shared/components';
import { TEST_DOCS, loadTestDoc, useTestDocs } from './testDocs';
import './TestDocs.css';

export function TestDocsPicker({ onPick }: { onPick: (text: string, fileName: string) => Promise<void> | void }) {
  const on = useTestDocs();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!on) return null;
  const pick = async (file: string) => {
    setBusy(file);
    setError(null);
    try {
      await onPick(await loadTestDoc(file), file);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card className="test-docs">
      <div className="test-docs__head">
        <h3><FlaskConical size={15} /> Test documents</h3>
        <span>Sample eLCs to try the checks. Turn off under Test docs in the user menu.</span>
      </div>
      <ul className="test-docs__list">
        {TEST_DOCS.map((d) => (
          <li key={d.file}>
            <span className="test-docs__icon">{d.file.endsWith('.jwt') ? <FileKey2 size={16} /> : <FileJson size={16} />}</span>
            <span className="test-docs__text">
              <strong>{d.title}</strong>
              <span>{d.detail} · <span className={`via via--${d.via.toLowerCase()}`}>{d.via}</span></span>
            </span>
            <Button size="sm" variant="secondary" icon={busy === d.file ? <Spinner size={14} /> : <ShieldCheck size={14} />}
              disabled={!!busy} onClick={() => void pick(d.file)}>Verify</Button>
          </li>
        ))}
      </ul>
      {error && <p className="test-docs__error">{error}</p>}
    </Card>
  );
}

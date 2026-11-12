// "Test docs" switch (user menu, on by default, remembered in this browser). When on, the Verify page lists sample
// eLCs to test with and Issue eLC shows "Fill details". Everything for this feature lives in src/test-docs/ and
// public/test-docs/; to remove it, delete both folders and the few lines marked "test-docs" in the pages.
import { useSyncExternalStore } from 'react';

const KEY = 'alpha-portal:test-docs';
const listeners = new Set<() => void>();

function read(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setTestDocs(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* blocked storage: the switch still works until reload */ }
  memory = on;
  listeners.forEach((l) => l());
}

let memory = read();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export const useTestDocs = () => useSyncExternalStore(subscribe, () => memory);

/** Sample eLCs shown on the Verify page (files in public/test-docs/). */
export const TEST_DOCS = [
  {
    file: 'bank-alpha-elc.json',
    title: 'Bank Alpha eLC · LC-2026-000512',
    detail: 'W3C credential (JSON) signed by Bank Alpha',
    via: 'TOTM',
  },
  {
    file: 'pila-elc.jwt',
    title: 'PILA eLC · ALPHAID-LC-2026-000418',
    detail: 'VC-JWT issued on PILA',
    via: 'PILA',
  },
] as const;

export async function loadTestDoc(file: string): Promise<string> {
  const res = await fetch(`/test-docs/${file}`);
  if (!res.ok) throw new Error(`Could not load the test document ${file}`);
  return res.text();
}

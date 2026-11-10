// What this browser session knows beyond the API: signed eLCs issued here (the API never stores eLC content), and a
// file handed from the inbox to the verify page.

const KEY = 'alpha-portal:signed-elcs';
const memory = new Map<string, Record<string, unknown>>();

export function rememberSigned(vc: Record<string, unknown>) {
  const id = String(vc.id ?? '');
  if (!id) return;
  memory.set(id, vc);
  try {
    const all = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
    all[id] = vc;
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the memory copy still works until reload */
  }
}

export function signedElc(vcId: string): Record<string, unknown> | null {
  if (memory.has(vcId)) return memory.get(vcId)!;
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')[vcId] ?? null;
  } catch {
    return null;
  }
}

let handoff: { vc: unknown; fileName: string } | null = null;
export const setVerifyHandoff = (vc: unknown, fileName: string) => { handoff = { vc, fileName }; };
export const takeVerifyHandoff = () => { const h = handoff; handoff = null; return h; };

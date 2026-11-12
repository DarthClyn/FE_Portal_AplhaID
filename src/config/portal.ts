// Portal configuration. Jurisdiction names and flags live ONLY here; pages and components read them from this file.

export type JurisdictionCode = 'ID' | 'VN';

export interface Jurisdiction {
  code: JurisdictionCode;
  name: string;
  /** Flag drawn as simple shapes (no image files). */
  flag: { stripes?: string[]; background?: string; star?: string };
}

export const JURISDICTIONS: Record<JurisdictionCode, Jurisdiction> = {
  ID: { code: 'ID', name: 'Indonesia', flag: { stripes: ['#CE1126', '#FFFFFF'] } },
  VN: { code: 'VN', name: 'Vietnam', flag: { background: '#DA251D', star: '#FFCD00' } },
};

export interface PartnerBank {
  /** Short label used across the UI, e.g. in "Available with". */
  name: string;
  bic: string;
  jurisdiction: JurisdictionCode;
  /** Platform whose inbox receives eLCs sent to this bank (the Send button on an issued eLC). */
  platform?: string;
}

export const PORTAL = {
  bank: {
    name: 'Bank Alpha',
    product: 'Trade Finance',
    badge: 'ID',
    jurisdiction: 'ID' as JurisdictionCode,
    /** Issuing bank name written into eLCs (field 51a/issuing bank). */
    legalName: 'Bank Alpha',
    bic: 'ALPHIDJA',
  },
  /** Role label shown under the signed-in user's name (the name comes from the login, see server/auth.js). */
  userRole: 'Trade Operations',
  /** Counterparty banks that can be picked as available-with / drawee / advising bank. */
  partners: [{ name: 'Bank Beta', bic: 'BETAVNVX', jurisdiction: 'VN', platform: 'PILA' }] as PartnerBank[],
  /** Times in the audit log are shown in this zone. */
  timeZone: { iana: 'Asia/Jakarta', label: 'WIB (UTC+7)' },
  managedBy: 'TOTM',
  features: {
    issue: true,
    inbox: true,
  },
  /** Credentials not issued by TOTM are verified on this platform (pila-verifier: PILA SDK + NDAKey). */
  externalPlatform: { name: 'PILA', jurisdiction: 'VN' as JurisdictionCode },
  /** Inbox page: its name and who sends to it. */
  inboxName: 'Alpha ID Inbox',
  inboxSenderLabel: 'PILA',
};

export const bankLabel = (name: string, j: JurisdictionCode) => `${name} · ${JURISDICTIONS[j].name}`;
export const homeBankLabel = () => bankLabel(PORTAL.bank.name, PORTAL.bank.jurisdiction);
export const partnerLabels = () => PORTAL.partners.map((p) => bankLabel(p.name, p.jurisdiction));
export const partnerByLabel = (label?: string | null) => PORTAL.partners.find((p) => bankLabel(p.name, p.jurisdiction) === label) ?? null;
export const partnerByBic = (bic?: string | null) => PORTAL.partners.find((p) => p.bic === String(bic ?? '').toUpperCase()) ?? null;
/** A partner named in free text, e.g. "BANK BETA VN, HO CHI MINH CITY" (imported JSON). */
export const partnerInText = (text?: string | null) => PORTAL.partners.find((p) => String(text ?? '').toLowerCase().includes(p.name.toLowerCase())) ?? null;

/** Jurisdiction from a SWIFT BIC (letters 5-6), when it is one we know. */
export function jurisdictionFromBic(bic?: string | null): Jurisdiction | null {
  const cc = (bic ?? '').slice(4, 6).toUpperCase();
  return (JURISDICTIONS as Record<string, Jurisdiction>)[cc] ?? null;
}

/** Jurisdiction from a bank label such as "Bank A · <name>". */
export function jurisdictionFromLabel(label?: string | null): Jurisdiction | null {
  if (!label) return null;
  return Object.values(JURISDICTIONS).find((j) => label.endsWith(`· ${j.name}`)) ?? null;
}

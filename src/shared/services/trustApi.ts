// TOTM Trust API calls used by the portal. Shapes follow the API responses ({code, message, data}).
import { http } from './http';

export type ElcStatus = 'active' | 'suspended' | 'expired' | 'not_found';
export type CheckResult = 'pass' | 'fail' | 'error';

export interface BankEntry {
  did: string;
  name: string;
  role?: string;
  bic?: string;
  status: string;
  isTrusted: boolean;
  publicKey: string | null;
  allowedDocs?: string[];
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface VcRecord {
  vcId: string;
  txId: string;
  issuerDid: string;
  status: ElcStatus;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  reason?: string;
}

export interface VcList {
  counts: { total: number; active: number; expiringIn30Days: number; expired: number; suspended: number };
  vcs: VcRecord[];
}

export interface ContentCheck {
  vcId: string | null;
  issuerDid: string | null;
  txId: string | null;
  integrity: { passed: boolean; result: CheckResult; message: string };
  issuer: { passed: boolean; result: CheckResult; message: string };
}

export interface VerificationContext {
  requestId: string;
  vcs: { vcid: string; txId: string | null; didPublicKey: string | null; isIssuerTrusted: boolean; status: ElcStatus }[];
}

export interface IssueResponse {
  txId: string;
  vcId: string;
  issuerDid: string;
  status: ElcStatus;
  validUntil: string | null;
  issuerTrusted: boolean;
  ignoredFields: string[];
  vc: Record<string, unknown>;
}

export interface AuditLine {
  time: string;
  requestId: string;
  partner: string | null;
  action: string;
  outcome: string;
  [detail: string]: unknown;
}

export interface InboxFile {
  fileId: string;
  from: string;
  to: string;
  fileName: string;
  contentType: string;
  size: number;
  sha256: string;
  txId: string | null;
  vcId: string | null;
  note: string | null;
  sentBy: string | null;
  sentAt: string;
  readAt: string | null;
  readBy: string | null;
  expiresAt: string;
}

const enc = encodeURIComponent;

export const trustApi = {
  health: () => http.get<{ status: string }>('/health'),
  bankByDid: (did: string) => http.get<BankEntry>(`/dids/${enc(did)}`),
  bankByBic: (bic: string) => http.get<BankEntry>(`/banks/${enc(bic)}`),

  verifyContent: (vc: unknown) => http.post<ContentCheck>('/vc/verify', { vc }, 60000),
  verificationContext: (vcId: string, issuerDid: string) =>
    http.post<VerificationContext>('/vp/verification-context', { vcIds: [{ vcId, issuerDid }] }),

  issueElc: (body: { data: Record<string, unknown>; attachments?: { filename: string; mimeType: string; data: string }[] }) =>
    http.post<IssueResponse>('/admin/elc/issue', body, 60000),
  listVcs: () => http.get<VcList>('/admin/vcs'),
  getVc: (vcId: string) => http.get<VcRecord>(`/admin/vcs/${enc(vcId)}`),
  suspendVc: (vcId: string, reason: string) => http.post<VcRecord>(`/admin/vcs/${enc(vcId)}/suspend`, { reason }),
  audit: (limit = 500, offset = 0) => http.get<{ total: number; lines: AuditLine[] }>(`/admin/audit?limit=${limit}&offset=${offset}`),

  /** Alpha ID inbox: files partners sent to this bank (TOTM side). */
  inbox: (limit = 100) => http.get<{ count: number; files: InboxFile[] }>(`/totm/inbox?limit=${limit}`),
  inboxFile: (fileId: string) => http.blob(`/totm/inbox/${enc(fileId)}`),
  inboxAck: (fileId: string) => http.post<InboxFile>(`/totm/inbox/${enc(fileId)}/ack`),
};

/** Bank names by DID, cached for the session (the registry rarely changes). */
const bankCache = new Map<string, Promise<BankEntry | null>>();
export function lookupBank(did: string): Promise<BankEntry | null> {
  if (!bankCache.has(did)) {
    bankCache.set(did, trustApi.bankByDid(did).then((r) => r.data).catch(() => null));
  }
  return bankCache.get(did)!;
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Copy, Download, FileText, History, Plus, XCircle } from 'lucide-react';
import { PORTAL } from '@/config/portal';
import {
  Banner, Button, Chip, CopyId, DateRangeMenu, EmptyState, PageHeader, Pagination, RowMenu, SearchInput, Spacer, Spinner,
  StatusPill, TableCard, allTime, daysAgo, paginate, rangeBounds, startOfYear, type RangePreset, type RangeValue,
} from '@/shared/components';
import { copyText, downloadCsv, downloadJson } from '@/shared/services/files';
import { daysUntil, fmtDate, relativeExpiry } from '@/shared/services/format';
import { signedElc } from '@/shared/services/session';
import { lookupBank, trustApi, type VcRecord } from '@/shared/services/trustApi';
import { useAsync } from '@/shared/services/useAsync';
import './Overview.css';

type Filter = 'all' | 'active' | 'expired' | 'suspended';
const PRESETS: RangePreset[] = [
  { id: '7', label: 'Last 7 days', since: daysAgo(7) },
  { id: '30', label: 'Last 30 days', since: daysAgo(30) },
  { id: '90', label: 'Last 90 days', since: daysAgo(90) },
  { id: 'year', label: 'This year', since: startOfYear },
  { id: 'all', label: 'All time', since: allTime },
];
const PAGE = 10;
export const elcPath = (vcId: string) => `/overview/${encodeURIComponent(vcId)}`;

/** Overview: every eLC this bank has issued, with counts, search, filters and row actions. */
export function OverviewPage() {
  const navigate = useNavigate();
  const { data, error, loading } = useAsync(() => trustApi.listVcs().then((r) => r.data));
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [range, setRange] = useState<RangeValue>({ preset: '90' });
  const [page, setPage] = useState(1);
  const [issuers, setIssuers] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const dids = [...new Set((data?.vcs ?? []).map((v) => v.issuerDid))];
    dids.forEach((d) => lookupBank(d).then((b) => b && setIssuers((m) => ({ ...m, [d]: b.name }))));
  }, [data]);

  const inRange = useMemo(() => {
    const [from, to] = rangeBounds(range, PRESETS);
    return (data?.vcs ?? []).filter((v) => { const t = Date.parse(v.createdAt); return t >= from && t <= to; });
  }, [data, range]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inRange
      .filter((v) => filter === 'all' || v.status === filter)
      .filter((v) => !s || [v.txId, v.vcId, issuers[v.issuerDid] ?? ''].some((x) => x.toLowerCase().includes(s)));
  }, [inRange, filter, q, issuers]);
  useEffect(() => setPage(1), [q, filter, range]);

  const count = (st: Filter) => inRange.filter((v) => st === 'all' || v.status === st).length;
  const soon = (data?.vcs ?? []).filter((v) => v.status === 'active' && v.validUntil && daysUntil(v.validUntil) <= 30)
    .sort((a, b) => (a.validUntil ?? '').localeCompare(b.validUntil ?? ''));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  const download = (v: VcRecord) => {
    const vc = signedElc(v.vcId);
    if (vc) downloadJson(vc, `${(vc.credentialSubject as { lcNumber?: string } | undefined)?.lcNumber ?? v.txId}.json`);
  };

  const exportCsv = () => downloadCsv([
    ['Tx ID', 'VC ID', 'Issuer', 'Issued', 'Expires', 'Status'],
    ...rows.map((v) => [v.txId, v.vcId, issuers[v.issuerDid] ?? v.issuerDid, v.createdAt.slice(0, 10), v.validUntil?.slice(0, 10) ?? '', v.status]),
  ], `elcs-${new Date().toISOString().slice(0, 10)}.csv`);

  return (
    <>
      <PageHeader title="Overview" actions={
        <>
          <Button icon={<Download size={16} />} onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
          {PORTAL.features.issue && <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/issue')}>Issue new eLC</Button>}
        </>
      } />
      {error && <Banner tone="bad" title="Could not load eLCs">{error.message}</Banner>}
      {msg && <Banner tone="info" title={msg} onClose={() => setMsg(null)} />}
      <div className="stats" data-tour="overview-stats">
        <Stat label="Active" value={data?.counts.active} sub={data ? `Out of ${data.counts.total} issued` : ''} icon={<CheckCircle2 size={16} />} tone="ok" />
        <Stat label="Expiring in 30 days" value={data?.counts.expiringIn30Days} sub={soon[0]?.validUntil ? `Earliest: ${fmtDate(soon[0].validUntil)}` : 'None due'} icon={<AlertTriangle size={16} />} tone="warn" />
        <Stat label="Expired" value={data?.counts.expired} sub={data?.counts.suspended ? `${data.counts.suspended} suspended` : 'Past their expiry date'} icon={<XCircle size={16} />} tone="neutral" />
      </div>
      <TableCard tour="overview-table"
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search Tx ID, VC ID or issuer" />
            <Chip on={filter === 'all'} onClick={() => setFilter('all')}>All · {count('all')}</Chip>
            <Chip on={filter === 'active'} onClick={() => setFilter('active')}>Active · {count('active')}</Chip>
            <Chip on={filter === 'expired'} onClick={() => setFilter('expired')}>Expired · {count('expired')}</Chip>
            {count('suspended') > 0 && <Chip on={filter === 'suspended'} onClick={() => setFilter('suspended')}>Suspended · {count('suspended')}</Chip>}
            <Spacer />
            <DateRangeMenu value={range} presets={PRESETS} onChange={setRange} heading="Issued" prefix="Issued: " />
          </>
        }
        footer={rows.length > 0 && (
          <>
            <span>Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} of {rows.length}</span>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      >
        <table className="tbl">
          <thead>
            <tr><th>Tx ID</th><th>VC ID</th><th>Issuer</th><th>Issued</th><th>Expires</th><th>Status</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={7} className="tbl__empty"><Spinner /></td></tr>}
            {data && !rows.length && (
              <tr><td colSpan={7} className="tbl__empty">
                <EmptyState title={data.vcs.length ? 'No eLCs match' : 'No eLCs issued yet'}>
                  {data.vcs.length ? 'Try another search, filter or date range.' : 'eLCs you issue appear here.'}
                </EmptyState>
              </td></tr>
            )}
            {paginate(rows, page, PAGE).map((v) => {
              const exp = relativeExpiry(v.validUntil);
              const isNew = -daysUntil(v.createdAt) < 1;
              const hasFile = !!signedElc(v.vcId);
              return (
                <tr key={v.vcId} className="tbl__row--click" onClick={() => navigate(elcPath(v.vcId))}>
                  <td><span className="row gap-8"><CopyId value={v.txId} full />{isNew && <span className="new-tag">NEW</span>}</span></td>
                  <td><CopyId value={v.vcId} /></td>
                  <td>{issuers[v.issuerDid] ?? <span className="mono faint">{v.issuerDid.slice(0, 18)}…</span>}</td>
                  <td>{fmtDate(v.createdAt)}</td>
                  <td>{fmtDate(v.validUntil)}<span className={`tbl__sub tone-${v.status === 'active' ? exp.tone : 'muted'}`}>{v.status === 'active' || v.status === 'expired' ? exp.text : ''}</span></td>
                  <td><StatusPill status={v.status} /></td>
                  <td>
                    <RowMenu items={[
                      { label: 'View details', icon: <FileText size={15} />, onClick: () => navigate(elcPath(v.vcId)) },
                      { label: 'Download signed eLC', icon: <Download size={15} />, disabled: !hasFile, onClick: () => download(v),
                        title: hasFile ? undefined : 'Only eLCs issued in this browser session can be downloaded here' },
                      { label: 'Copy Tx ID', icon: <Copy size={15} />, onClick: () => { void copyText(v.txId); setMsg(`Copied ${v.txId}`); } },
                      { label: 'Copy VC ID', icon: <Copy size={15} />, onClick: () => { void copyText(v.vcId); setMsg('Copied VC ID'); } },
                      { label: 'View in Audit log', icon: <History size={15} />, dividerBefore: true, onClick: () => navigate(`/audit?q=${encodeURIComponent(v.txId)}`) },
                    ]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}

function Stat({ label, value, sub, icon, tone }: { label: string; value?: number; sub: string; icon: React.ReactNode; tone: 'ok' | 'warn' | 'neutral' }) {
  return (
    <div className="stat">
      <div className="stat__head"><span>{label}</span><span className={`stat__icon stat__icon--${tone}`}>{icon}</span></div>
      <strong className="stat__value">{value ?? '–'}</strong>
      <span className="stat__sub">{sub}</span>
    </div>
  );
}

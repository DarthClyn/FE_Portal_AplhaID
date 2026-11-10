import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Download, Lock, RefreshCw } from 'lucide-react';
import { PORTAL } from '@/config/portal';
import {
  Banner, Button, Chip, CopyId, DateRangeMenu, EmptyState, PageHeader, Pagination, SearchInput, Spacer, Spinner, StatusPill, TableCard,
  allTime, daysAgo, rangeBounds, type RangePreset, type RangeValue,
} from '@/shared/components';
import { toEvent, type AuditCategory, type AuditEvent } from '@/shared/services/auditEvents';
import { downloadCsv } from '@/shared/services/files';
import { dayKey, fmtClock, fmtDayLong } from '@/shared/services/format';
import { trustApi } from '@/shared/services/trustApi';
import { useAsync } from '@/shared/services/useAsync';
import './Audit.css';

type Filter = 'all' | AuditCategory | 'problems';
const PRESETS: RangePreset[] = [
  { id: '1', label: 'Last 24 hours', since: daysAgo(1) },
  { id: '7', label: 'Last 7 days', since: daysAgo(7) },
  { id: '30', label: 'Last 30 days', since: daysAgo(30) },
  { id: 'all', label: 'All time', since: allTime },
];
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All events' }, { id: 'issuing', label: 'Issuing' }, { id: 'verification', label: 'Verification' }, { id: 'inbox', label: 'Inbox' },
];
const PAGE = 10;

export function AuditPage() {
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useAsync(() => trustApi.audit(500).then((r) => ({ total: r.data.total, events: r.data.lines.map(toEvent) })));
  const [q, setQ] = useState(params.get('q') ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const [range, setRange] = useState<RangeValue>({ preset: '7' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const inRange = useMemo(() => {
    const [from, to] = rangeBounds(range, PRESETS);
    return (data?.events ?? []).filter((e) => { const t = Date.parse(e.time); return t >= from && t <= to; });
  }, [data, range]);
  const problems = inRange.filter((e) => e.problem).length;
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inRange
      .filter((e) => filter === 'all' || (filter === 'problems' ? e.problem : e.category === filter))
      .filter((e) => !s || [e.txId, e.vcId, e.label, e.code, e.by, e.line.requestId].some((x) => (x ?? '').toLowerCase().includes(s)));
  }, [inRange, filter, q]);
  useEffect(() => setPage(1), [q, filter, range]);

  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86400_000).toISOString());
  const groupName = (k: string) => (k === today ? 'Today' : k === yesterday ? 'Yesterday' : '');

  const exportCsv = () => downloadCsv([
    ['Time', 'Event', 'Code', 'Tx ID', 'VC ID', 'By', 'Result', 'Request ID'],
    ...rows.map((e) => [e.time, e.label, e.code, e.txId, e.vcId, e.by, e.result?.text ?? '', e.line.requestId]),
  ], `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);

  return (
    <>
      <PageHeader title="Audit log" actions={
        <>
          <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={reload} loading={loading && !!data}>Refresh</Button>
          <Button icon={<Download size={16} />} onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
        </>
      } />
      {error && <Banner tone="bad" title="Could not load the audit log">{error.message}</Banner>}
      <TableCard
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search Tx ID, VC ID or request ID" />
            {FILTERS.map((f) => <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>)}
            <Chip on={filter === 'problems'} tone="bad" onClick={() => setFilter('problems')}>Problems · {problems}</Chip>
            <Spacer />
            <DateRangeMenu value={range} presets={PRESETS} onChange={setRange} heading="Time" />
          </>
        }
        footer={
          <>
            <span>{rows.length ? `${pageRows.length} of ${rows.length} events` : 'No events'} · times in {PORTAL.timeZone.label}</span>
            <Pagination page={page} pages={Math.max(1, Math.ceil(rows.length / PAGE))} onPage={setPage} />
          </>
        }
      >
        <table className="tbl audit">
          <thead>
            <tr><th>Time</th><th>Event</th><th>Tx ID</th><th>VC ID</th><th>By</th><th>Result</th><th aria-label="Open" /></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={7} className="tbl__empty"><Spinner /></td></tr>}
            {data && !rows.length && <tr><td colSpan={7} className="tbl__empty"><EmptyState title="No events">Try another filter or date range.</EmptyState></td></tr>}
            {pageRows.map((e, i) => {
              const k = dayKey(e.time);
              const newDay = i === 0 || dayKey(pageRows[i - 1].time) !== k;
              return (
                <Fragment key={e.key}>
                  {newDay && <tr className="tbl__group"><td colSpan={7}><strong>{groupName(k) || fmtDayLong(k)}</strong> {groupName(k) && <span className="muted">{fmtDayLong(k)}</span>}</td></tr>}
                  <Row e={e} open={open === e.key} onToggle={() => setOpen(open === e.key ? null : e.key)} />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </TableCard>
      <p className="audit-foot"><Lock size={13} /> Append-only · eLC content is never stored here</p>
    </>
  );
}

function Row({ e, open, onToggle }: { e: AuditEvent; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={`tbl__row--click${open ? ' audit__row--open' : ''}`} onClick={onToggle}>
        <td className="mono muted">{fmtClock(e.time)}</td>
        <td>{e.label}<span className="tbl__sub mono">{e.code}</span></td>
        <td>{e.txId ? <CopyId value={e.txId} full /> : <span className="faint">—</span>}</td>
        <td>{e.vcId ? <span className="mono muted">{e.vcId.replace(/^urn:uuid:/, '').slice(0, 4)}…{e.vcId.slice(-4)}</span> : <span className="faint">—</span>}</td>
        <td>{e.by}</td>
        <td>{e.result ? <StatusPill status={e.result.text} tone={e.result.tone === 'none' ? 'neutral' : e.result.tone} /> : <span className="faint">—</span>}</td>
        <td>{open ? <ChevronUp size={16} className="muted" /> : <ChevronDown size={16} className="muted" />}</td>
      </tr>
      {open && (
        <tr className="audit__detail">
          <td />
          <td colSpan={6}>
            <div className="audit__grid">
              {e.details.map((d) => (
                <div key={d.label}><span className="muted">{d.label}</span><span className={d.mono ? 'mono' : ''}>{d.value}</span></div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

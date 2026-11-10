import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileJson, FileText, Image as ImageIcon, Inbox, RefreshCw, ShieldCheck } from 'lucide-react';
import { PORTAL } from '@/config/portal';
import {
  Banner, Button, Chip, CopyId, EmptyState, PageHeader, Pagination, RowMenu, SearchInput, Spinner, StatusPill, TableCard, paginate,
} from '@/shared/components';
import { downloadBlob } from '@/shared/services/files';
import { fmtDateTime, fmtSize } from '@/shared/services/format';
import { setVerifyHandoff } from '@/shared/services/session';
import { parseCredentialText } from '@/shared/services/verification';
import { trustApi, type InboxFile } from '@/shared/services/trustApi';
import { useAsync } from '@/shared/services/useAsync';
import './Inbox.css';

type Filter = 'all' | 'new' | 'read';
const PAGE = 10;

/** Files partners sent to the Alpha ID inbox (POST /pila/send on their side). */
export function InboxPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload, setData } = useAsync(() => trustApi.inbox(100).then((r) => r.data.files));
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'bad' | 'info'; text: string } | null>(null);

  const files = data ?? [];
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return files
      .filter((f) => filter === 'all' || (filter === 'new' ? !f.readAt : !!f.readAt))
      .filter((f) => !s || [f.fileName, f.txId ?? '', f.vcId ?? '', f.sentBy ?? ''].some((x) => x.toLowerCase().includes(s)));
  }, [files, filter, q]);
  const unread = files.filter((f) => !f.readAt).length;

  const markRead = async (f: InboxFile) => {
    if (f.readAt) return;
    const r = await trustApi.inboxAck(f.fileId);
    setData((list) => (list ?? []).map((x) => (x.fileId === f.fileId ? r.data : x)));
  };

  const download = async (f: InboxFile) => {
    setBusy(f.fileId);
    try {
      const { blob } = await trustApi.inboxFile(f.fileId);
      downloadBlob(blob, f.fileName);
      await markRead(f);
    } catch (e) {
      setMsg({ tone: 'bad', text: `Could not download ${f.fileName}: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  };

  const verify = async (f: InboxFile) => {
    setBusy(f.fileId);
    try {
      const { blob } = await trustApi.inboxFile(f.fileId);
      const vc = parseCredentialText(await blob.text(), f.fileName);
      await markRead(f);
      setVerifyHandoff(vc, f.fileName);
      navigate('/verify');
    } catch (e) {
      setMsg({ tone: 'bad', text: `Could not open ${f.fileName} for verification: ${(e as Error).message}` });
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Inbox" subtitle={`${PORTAL.inboxName}: files ${PORTAL.inboxSenderLabel} sent to ${PORTAL.bank.name}. Kept for 30 days.`}
        actions={<Button variant="ghost" icon={<RefreshCw size={15} />} onClick={reload} loading={loading && !!data}>Refresh</Button>} />
      {error && <Banner tone="bad" title="Could not load the inbox">{error.message}</Banner>}
      {msg && <Banner tone={msg.tone} title={msg.text} onClose={() => setMsg(null)} />}
      <TableCard
        toolbar={
          <>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search file, Tx ID or VC ID" />
            <Chip on={filter === 'all'} onClick={() => { setFilter('all'); setPage(1); }}>All · {files.length}</Chip>
            <Chip on={filter === 'new'} onClick={() => { setFilter('new'); setPage(1); }}>New · {unread}</Chip>
            <Chip on={filter === 'read'} onClick={() => { setFilter('read'); setPage(1); }}>Read · {files.length - unread}</Chip>
          </>
        }
        footer={rows.length > PAGE && <><span>{rows.length} files</span><Pagination page={page} pages={Math.ceil(rows.length / PAGE)} onPage={setPage} /></>}
      >
        <table className="tbl">
          <thead><tr><th>File</th><th>Tx ID</th><th>VC ID</th><th>From</th><th>Received</th><th>Status</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan={7} className="tbl__empty"><Spinner /></td></tr>}
            {data && !rows.length && (
              <tr><td colSpan={7} className="tbl__empty">
                <EmptyState icon={<Inbox size={20} />} title={files.length ? 'No files match' : 'No files yet'}>
                  {files.length ? 'Try another search or filter.' : `Files ${PORTAL.inboxSenderLabel} sends will appear here.`}
                </EmptyState>
              </td></tr>
            )}
            {paginate(rows, page, PAGE).map((f) => (
              <tr key={f.fileId} className={f.readAt ? '' : 'inbox__new'}>
                <td>
                  <span className="inbox-file">
                    <span className="inbox-file__icon">{icon(f.contentType)}</span>
                    <span><strong>{f.fileName}</strong><span className="tbl__sub">{fmtSize(f.size)}{f.note ? ` · ${f.note}` : ''}</span></span>
                  </span>
                </td>
                <td>{f.txId ? <CopyId value={f.txId} full /> : <span className="faint">—</span>}</td>
                <td>{f.vcId ? <CopyId value={f.vcId} /> : <span className="faint">—</span>}</td>
                <td>{f.sentBy ?? f.from.toUpperCase()}</td>
                <td>{fmtDateTime(f.sentAt)}</td>
                <td><StatusPill status={f.readAt ? 'Read' : 'New'} /></td>
                <td>
                  <span className="row gap-8 inbox-actions">
                    {busy === f.fileId ? <Spinner size={16} /> : (
                      <>
                        {f.contentType === 'application/json' && <Button size="sm" variant="secondary" icon={<ShieldCheck size={14} />} onClick={() => void verify(f)}>Verify</Button>}
                        <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => void download(f)}>Download</Button>
                        <RowMenu items={[{ label: 'Mark as read', disabled: !!f.readAt, onClick: () => void markRead(f) }]} />
                      </>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}

const icon = (type: string) =>
  type === 'application/json' ? <FileJson size={16} /> : type.startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />;

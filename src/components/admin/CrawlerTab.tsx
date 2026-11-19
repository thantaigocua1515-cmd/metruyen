import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import {
  deleteCrawlerSource,
  invokeCrawlerWorker,
  listCrawlerJobs,
  listCrawlerSources,
  saveCrawlerSource,
} from '../../lib/crawler';
import { normalizeCrawlerHosts } from '../../lib/crawler-validation';
import type {
  CrawlerJob,
  CrawlerPreview,
  CrawlerSelectors,
  CrawlerSource,
} from '../../lib/crawler';

const card =
  'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-800';
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition';
const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition';

const emptySelectors: CrawlerSelectors = {
  title: 'h1',
  author: '',
  description: '',
  cover: '',
  chapterLinks: 'a',
  chapterContent: 'body',
  chapterTitle: 'h1',
};

function statusLabel(status: CrawlerJob['status']): string {
  return {
    pending: 'Chờ chạy',
    running: 'Đang chạy',
    paused: 'Tạm dừng',
    done: 'Hoàn tất',
    error: 'Lỗi',
    cancelled: 'Đã hủy',
  }[status];
}

function statusClass(status: CrawlerJob['status']): string {
  if (status === 'done') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (status === 'error') return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
  if (status === 'running') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export default function CrawlerTab() {
  const [sources, setSources] = useState<CrawlerSource[]>([]);
  const [jobs, setJobs] = useState<CrawlerJob[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [hosts, setHosts] = useState('');
  const [selectors, setSelectors] = useState<CrawlerSelectors>(emptySelectors);
  const [sourceUrl, setSourceUrl] = useState('');
  const [maxChapters, setMaxChapters] = useState('100');
  const [preview, setPreview] = useState<CrawlerPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const [nextSources, nextJobs] = await Promise.all([listCrawlerSources(), listCrawlerJobs()]);
      setSources(nextSources);
      setJobs(nextJobs);
      setSourceId((current) => current || nextSources[0]?.id || '');
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : 'Không tải được crawler.'}`);
    }
  };

  useEffect(() => {
    void load();
    let channel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null;
    try {
      const client = getSupabase();
      channel = client
        .channel('crawler-jobs-admin')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crawler_jobs' }, () => {
          void load();
        })
        .subscribe();
    } catch {
      // Supabase errors are displayed by the explicit load/action paths.
    }
    return () => {
      if (channel) void getSupabase().removeChannel(channel);
    };
  }, []);

  const patchSelector = (key: keyof CrawlerSelectors, value: string) => {
    setSelectors((current) => ({ ...current, [key]: value }));
  };

  const saveSource = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await saveCrawlerSource({
        id: sourceId.trim().toLowerCase(),
        name: sourceName,
        allowedHosts: normalizeCrawlerHosts(hosts),
        selectors,
      });
      setSources((current) => [...current.filter((source) => source.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
      setSourceId(saved.id);
      setMessage(`✅ Đã lưu nguồn ${saved.name}.`);
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : 'Lưu nguồn thất bại.'}`);
    } finally {
      setBusy(false);
    }
  };

  const selectSource = (source: CrawlerSource) => {
    setSourceId(source.id);
    setSourceName(source.name);
    setHosts(source.allowed_hosts.join(', '));
    setSelectors({ ...emptySelectors, ...source.selectors });
    setPreview(null);
  };

  const removeSource = async (source: CrawlerSource) => {
    if (!window.confirm(`Xóa nguồn crawler "${source.name}" và các job của nguồn này?`)) return;
    setBusy(true);
    try {
      await deleteCrawlerSource(source.id);
      setSources((current) => current.filter((item) => item.id !== source.id));
      if (sourceId === source.id) {
        setSourceId('');
        setSourceName('');
        setHosts('');
        setPreview(null);
      }
      setMessage('✅ Đã xóa nguồn crawler.');
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : 'Xóa nguồn thất bại.'}`);
    } finally {
      setBusy(false);
    }
  };

  const inspect = async () => {
    if (!sourceId || !sourceUrl.trim()) {
      setMessage('❌ Chọn nguồn và nhập URL truyện trước.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await invokeCrawlerWorker<CrawlerPreview>('inspect', {
        source_id: sourceId,
        source_url: sourceUrl.trim(),
      });
      setPreview(result);
      setMessage(`✅ Đã đọc metadata: ${result.title} · ${result.chapters.length} liên kết chương hợp lệ.`);
    } catch (error) {
      setPreview(null);
      setMessage(`❌ ${error instanceof Error ? error.message : 'Inspect thất bại.'}`);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!sourceId || !sourceUrl.trim()) {
      setMessage('❌ Chọn nguồn và nhập URL truyện trước.');
      return;
    }
    const limit = Math.min(300, Math.max(1, Number.parseInt(maxChapters, 10) || 100));
    setBusy(true);
    setMessage(null);
    try {
      const result = await invokeCrawlerWorker<{ job_id: string; preview: CrawlerPreview }>('start', {
        source_id: sourceId,
        source_url: sourceUrl.trim(),
        max_chapters: limit,
      });
      setPreview(result.preview);
      setMessage(`▶ Đã tạo job ${result.job_id.slice(0, 8)}…; tiến trình sẽ cập nhật bên dưới.`);
      await load();
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : 'Không thể bắt đầu crawler.'}`);
    } finally {
      setBusy(false);
    }
  };

  const jobAction = async (job: CrawlerJob, action: 'cancel' | 'resume') => {
    setBusy(true);
    try {
      await invokeCrawlerWorker(action, { job_id: job.id });
      setMessage(action === 'cancel' ? '⏹ Đã gửi lệnh hủy job.' : '▶ Đã gửi lệnh tiếp tục job.');
      await load();
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : 'Thao tác job thất bại.'}`);
    } finally {
      setBusy(false);
    }
  };

  const selectedSource = sources.find((source) => source.id === sourceId);

  return (
    <div className="space-y-4">
      <div className={`${card} border-indigo-200 dark:border-indigo-900/60`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white">🕷️ Crawler HTML an toàn</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Chỉ admin mới dùng được. Worker chỉ truy cập hostname đã allowlist, không nhận cookie/proxy tùy ý,
              giới hạn 300 chương và ghi kết quả vào <code>synced_novels</code>/<code>synced_chapters</code>.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            Cần chạy migration + deploy Edge Function
          </span>
        </div>
        {message && <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{message}</p>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className={`${card} space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 dark:text-white">1. Nguồn được phép</h3>
            <button
              className={btnGhost}
              onClick={() => {
                setSourceId('');
                setSourceName('');
                setHosts('');
                setSelectors(emptySelectors);
                setPreview(null);
              }}
            >
              Nguồn mới
            </button>
          </div>
          <select value={sourceId} onChange={(event) => {
            const source = sources.find((item) => item.id === event.target.value);
            if (source) selectSource(source);
            else setSourceId(event.target.value);
          }} className={inputCls}>
            <option value="">Chọn nguồn…</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
          <input className={inputCls} value={sourceId} onChange={(event) => setSourceId(event.target.value)} placeholder="ID: truyenfull" />
          <input className={inputCls} value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Tên nguồn" />
          <input className={inputCls} value={hosts} onChange={(event) => setHosts(event.target.value)} placeholder="Hostname, phân cách bằng dấu phẩy" />
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} value={selectors.title ?? ''} onChange={(event) => patchSelector('title', event.target.value)} placeholder="Selector tiêu đề (h1)" />
            <input className={inputCls} value={selectors.author ?? ''} onChange={(event) => patchSelector('author', event.target.value)} placeholder="Selector tác giả (tùy chọn)" />
            <input className={inputCls} value={selectors.chapterLinks ?? ''} onChange={(event) => patchSelector('chapterLinks', event.target.value)} placeholder="Selector link chương (a)" />
            <input className={inputCls} value={selectors.chapterContent ?? ''} onChange={(event) => patchSelector('chapterContent', event.target.value)} placeholder="Selector nội dung (body)" />
            <input className={inputCls} value={selectors.chapterTitle ?? ''} onChange={(event) => patchSelector('chapterTitle', event.target.value)} placeholder="Selector tiêu đề chương (h1)" />
            <input className={inputCls} value={selectors.cover ?? ''} onChange={(event) => patchSelector('cover', event.target.value)} placeholder="Selector ảnh bìa (tùy chọn)" />
          </div>
          <button className={btnPrimary} disabled={busy} onClick={() => void saveSource()}>💾 Lưu allowlist</button>
          <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
                <button className="min-w-0 flex-1 truncate text-left font-semibold text-indigo-600 dark:text-indigo-300" onClick={() => selectSource(source)}>{source.name}</button>
                <span className="truncate text-slate-400">{source.allowed_hosts.join(', ')}</span>
                <button className="text-rose-600" disabled={busy} onClick={() => void removeSource(source)}>Xóa</button>
              </div>
            ))}
            {sources.length === 0 && <p className="text-xs italic text-slate-500">Chưa có nguồn crawler.</p>}
          </div>
        </div>

        <div className={`${card} space-y-3`}>
          <h3 className="font-bold text-slate-900 dark:text-white">2. Kiểm tra và chạy</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Nguồn hiện tại: {selectedSource?.name ?? 'chưa chọn'}</p>
          <input className={inputCls} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://example.com/truyen/ten-truyen" inputMode="url" />
          <div className="flex flex-wrap gap-2">
            <input className={`${inputCls} max-w-[180px]`} value={maxChapters} onChange={(event) => setMaxChapters(event.target.value.replace(/\D/g, ''))} placeholder="Tối đa chương" inputMode="numeric" />
            <button className={btnGhost} disabled={busy || !selectedSource} onClick={() => void inspect()}>🔍 Inspect</button>
            <button className={btnPrimary} disabled={busy || !selectedSource} onClick={() => void start()}>▶ Bắt đầu crawl</button>
          </div>
          {preview && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <p className="font-bold text-emerald-900 dark:text-emerald-200">{preview.title}</p>
              {preview.author && <p className="text-xs text-emerald-800 dark:text-emerald-300">Tác giả: {preview.author}</p>}
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">{preview.chapters.length} link chương · {preview.sourceUrl}</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
                {preview.chapters.slice(0, 20).map((chapter) => <p key={`${chapter.number}-${chapter.url}`}><b>{chapter.number}.</b> {chapter.title}</p>)}
              </div>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Chỉ crawl nội dung bạn có quyền sử dụng và tuân thủ điều khoản/robots của nguồn. Không có cơ chế bypass Cloudflare/VIP,
            không lưu cookie hoặc proxy vào database.
          </p>
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900 dark:text-white">3. Tiến trình job ({jobs.length})</h3>
          <button className={btnGhost} disabled={busy} onClick={() => void load()}>↻ Tải lại</button>
        </div>
        <div className="mt-3 space-y-2">
          {jobs.map((job) => {
            const percent = job.total ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0;
            return (
              <div key={job.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{String(job.metadata.title ?? job.source_url)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(job.status)}`}>{statusLabel(job.status)}</span>
                  {(job.status === 'pending' || job.status === 'running') && <button className={btnGhost} disabled={busy} onClick={() => void jobAction(job, 'cancel')}>Hủy</button>}
                  {(job.status === 'error' || job.status === 'paused' || job.status === 'cancelled') && <button className={btnPrimary} disabled={busy} onClick={() => void jobAction(job, 'resume')}>Tiếp tục</button>}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} /></div>
                  <span>{job.done}/{job.total} · bỏ qua {job.skipped}</span>
                </div>
                {job.error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{job.error}</p>}
              </div>
            );
          })}
          {jobs.length === 0 && <p className="py-4 text-center text-sm italic text-slate-500">Chưa có crawler job.</p>}
        </div>
      </div>
    </div>
  );
}

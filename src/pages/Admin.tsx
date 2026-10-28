import { useEffect, useRef, useState } from 'react';
import { getSupabase, getSupabaseUrl } from '../lib/supabase';
import { fetchOpenApiInfo, fetchNovels } from '../lib/novelApi';
import type { ApiSourceRow, NovelSummary } from '../lib/novelApi';
import { syncNovelList, syncChapters, checkUpdates } from '../lib/sync';
import { getSyncedNovels } from '../lib/library';
import type { SyncedNovelRow } from '../lib/library';
import { testGeminiKey, translateText, generateGeminiCover, getActiveKeys } from '../lib/translate';
import {
  getCloudflareConfig,
  saveCloudflareConfig,
  generateCloudflareCover,
  testCloudflareWorker,
} from '../lib/cloudflare';
import { uploadCover } from '../components/CoverGenerator';
import ChapterManager from '../components/admin/ChapterManager';
import GlossaryManager from '../components/admin/GlossaryManager';
import type { CosmeticItem } from '../components/Treasury';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';
import { TEMPLATES, getTemplateDef } from '../theme/templates';

type Tab = 'overview' | 'users' | 'sources' | 'sync' | 'chapters' | 'glossary' | 'gemini' | 'import' | 'thumbnails' | 'items' | 'defaults' | 'theme' | 'system' | 'announce';

const card =
  'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900';
const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-800';
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition';
const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition';

/* ---------------- Tổng quan SaaS Dashboard ---------------- */
function OverviewTab({ onSelectTab }: { onSelectTab?: (tab: Tab) => void }) {
  const [stats, setStats] = useState({ users: 0, hours: 0, shelf: 0, sources: 0, items: 0 });
  const { template } = useTemplate();
  const currentTemplate = getTemplateDef(template);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      const [{ count: users }, { count: shelf }, { count: sources }, { count: items }] =
        await Promise.all([
          sb.from('profiles').select('id', { count: 'exact', head: true }),
          sb.from('bookshelf').select('novel_id', { count: 'exact', head: true }),
          sb.from('api_sources').select('id', { count: 'exact', head: true }),
          sb.from('cosmetic_items').select('id', { count: 'exact', head: true }),
        ]);
      const { data } = await sb.from('profiles').select('reading_seconds');
      const hours =
        ((data ?? []) as { reading_seconds: number }[]).reduce(
          (s, r) => s + (r.reading_seconds || 0),
          0,
        ) / 3600;
      setStats({
        users: users ?? 0,
        hours: Math.round(hours * 10) / 10,
        shelf: shelf ?? 0,
        sources: sources ?? 0,
        items: items ?? 0,
      });
    })();
  }, []);

  const kpis = [
    {
      label: 'Tổng Thành Viên',
      val: String(stats.users),
      sub: 'Đạo hữu đăng ký',
      icon: '👥',
      color: 'from-blue-500 to-indigo-600',
      badge: '+Live',
    },
    {
      label: 'Tổng Giờ Đọc Sách',
      val: `${stats.hours}h`,
      sub: 'Tu vi tích lũy',
      icon: '⏳',
      color: 'from-purple-500 to-pink-600',
      badge: 'Realtime',
    },
    {
      label: 'Lượt Lưu Tủ Sách',
      val: String(stats.shelf),
      sub: 'Truyện đang theo dõi',
      icon: '📚',
      color: 'from-amber-500 to-orange-600',
      badge: 'Tủ sách',
    },
    {
      label: 'Nguồn API Crawl',
      val: String(stats.sources),
      sub: 'Nguồn liên kết ngoài',
      icon: '🔗',
      color: 'from-emerald-500 to-teal-600',
      badge: 'Active',
    },
    {
      label: 'Vật Phẩm Tàng Bảo',
      val: String(stats.items),
      sub: 'Pháp bảo & Danh hiệu',
      icon: '⚔️',
      color: 'from-rose-500 to-red-600',
      badge: 'Shop',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 5 Thẻ KPI chuẩn SaaS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl shadow-inner dark:bg-slate-800">
                {k.icon}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {k.badge}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {k.val}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {k.label}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2 Cột: Phím tắt hành động nhanh & Tình trạng hệ thống */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Phím tắt */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>⚡</span> Phím Tắt Thao Tác Nhanh
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Truy cập trực tiếp các mô-đun vận hành thường dùng
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              onClick={() => onSelectTab?.('sync')}
              className="flex flex-col items-center justify-center rounded-xl border border-slate-200 p-4 text-center transition hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:bg-slate-800/80"
            >
              <span className="text-2xl">🔄</span>
              <span className="mt-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                Đồng Bộ Truyện
              </span>
              <span className="text-[10px] text-slate-500">Cập nhật chương</span>
            </button>
            <button
              onClick={() => onSelectTab?.('import')}
              className="flex flex-col items-center justify-center rounded-xl border border-slate-200 p-4 text-center transition hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:bg-slate-800/80"
            >
              <span className="text-2xl">✍️</span>
              <span className="mt-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                Nhập Truyện Tay
              </span>
              <span className="text-[10px] text-slate-500">Thêm chương mới</span>
            </button>
            <button
              onClick={() => onSelectTab?.('gemini')}
              className="flex flex-col items-center justify-center rounded-xl border border-slate-200 p-4 text-center transition hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:bg-slate-800/80"
            >
              <span className="text-2xl">🤖</span>
              <span className="mt-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                Gemini API Keys
              </span>
              <span className="text-[10px] text-slate-500">Dịch AI tự động</span>
            </button>
            <button
              onClick={() => onSelectTab?.('theme')}
              className="flex flex-col items-center justify-center rounded-xl border border-slate-200 p-4 text-center transition hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:bg-slate-800/80"
            >
              <span className="text-2xl">🎨</span>
              <span className="mt-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                6 Bộ Giao Diện
              </span>
              <span className="text-[10px] text-slate-500">Đổi skin site</span>
            </button>
          </div>
        </div>

        {/* Tình trạng hệ thống */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🛡️</span> Hạ Tầng SaaS
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Trạng thái kết nối và công nghệ
          </p>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-slate-500">Database Backend:</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Supabase PG
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-slate-500">Giao diện kích hoạt:</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {currentTemplate.name}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-slate-500">Frontend Stack:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                React 18 + Tailwind 4
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500">Cloudflare Worker:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Active / Edge API
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Người dùng ---------------- */
interface UserRow {
  id: string;
  username: string;
  role: string;
  reading_seconds: number;
  spirit_stones: number;
  created_at: string;
}

function UserRowEditor({ row, onChanged }: { row: UserRow; onChanged: () => void }) {
  const [role, setRole] = useState(row.role);
  const [dHours, setDHours] = useState('');
  const [dStones, setDStones] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    try {
      const sb = getSupabase();
      const dh = parseFloat(dHours) || 0;
      const ds = parseInt(dStones, 10) || 0;
      const { error } = await sb
        .from('profiles')
        .update({
          role,
          reading_seconds: Math.max(0, row.reading_seconds + Math.round(dh * 3600)),
          spirit_stones: Math.max(0, row.spirit_stones + ds),
        })
        .eq('id', row.id);
      if (error) throw error;
      setDHours('');
      setDStones('');
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Cập nhật thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Xóa tài khoản "${row.username}"? (Hồ sơ bị xóa; tài khoản đăng nhập gốc cần xóa tay trong Supabase Auth)`))
      return;
    const sb = getSupabase();
    const { error } = await sb.from('profiles').delete().eq('id', row.id);
    if (error) alert(error.message);
    else onChanged();
  };

  return (
    <div className={`${card} space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-bold text-stone-900 dark:text-stone-100">{row.username}</p>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-full border border-amber-900/20 bg-white px-2 py-1 text-xs dark:border-amber-100/15 dark:bg-stone-800 dark:text-stone-100"
        >
          <option value="user">user</option>
          <option value="admin">admin 👑</option>
        </select>
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        ⏳ {(row.reading_seconds / 3600).toFixed(1)} giờ · 💎 {row.spirit_stones} linh thạch
      </p>
      <div className="flex gap-2">
        <input
          value={dHours}
          onChange={(e) => setDHours(e.target.value)}
          placeholder="± giờ đọc"
          inputMode="decimal"
          className={inputCls}
        />
        <input
          value={dStones}
          onChange={(e) => setDStones(e.target.value)}
          placeholder="± linh thạch"
          inputMode="numeric"
          className={inputCls}
        />
      </div>
      <div className="flex gap-2">
        <button onClick={() => void apply()} disabled={busy} className={btnPrimary}>
          {busy ? '...' : 'Áp dụng'}
        </button>
        <button
          onClick={() => void remove()}
          className="rounded-full bg-red-100 px-4 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-300"
        >
          Xóa
        </button>
      </div>
    </div>
  );
}

function UsersTab() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const load = async () => {
    const sb = getSupabase();
    const { data } = await sb
      .from('profiles')
      .select('id,username,role,reading_seconds,spirit_stones,created_at')
      .order('created_at', { ascending: true });
    setRows((data ?? []) as UserRow[]);
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <UserRowEditor key={r.id} row={r} onChanged={() => void load()} />
      ))}
      {rows.length === 0 && <p className="italic text-stone-500">Chưa có người dùng nào.</p>}
    </div>
  );
}

/* ---------------- Nguồn API ---------------- */
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `src-${Date.now()}`;

function SourcesTab() {
  const [sources, setSources] = useState<ApiSourceRow[]>([]);
  const [name, setName] = useState('');
  const [openapiUrl, setOpenapiUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  const load = async () => {
    const sb = getSupabase();
    const { data } = await sb.from('api_sources').select('*').order('created_at');
    setSources((data ?? []) as ApiSourceRow[]);
  };
  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!name.trim() || !openapiUrl.trim()) {
      alert('Nhập tên và link openapi.json.');
      return;
    }
    const sb = getSupabase();
    if (editingId) {
      await sb.from('api_sources').update({ name: name.trim(), openapi_url: openapiUrl.trim() }).eq('id', editingId);
    } else {
      const { error } = await sb.from('api_sources').insert({
        id: slugify(name),
        name: name.trim(),
        openapi_url: openapiUrl.trim(),
        is_active: true,
      });
      if (error) {
        alert(error.message);
        return;
      }
    }
    setName('');
    setOpenapiUrl('');
    setEditingId(null);
    void load();
  };

  const check = async (s: ApiSourceRow) => {
    setChecking(s.id);
    try {
      const info = await fetchOpenApiInfo(s.openapi_url);
      const sb = getSupabase();
      await sb.from('api_sources').update({ base_url: info.baseUrl }).eq('id', s.id);
      setResults((r) => ({ ...r, [s.id]: `✅ OK — ${info.apiTitle} @ ${info.baseUrl}` }));
      void load();
    } catch (e) {
      setResults((r) => ({ ...r, [s.id]: `❌ ${e instanceof Error ? e.message : 'Lỗi'}` }));
    } finally {
      setChecking(null);
    }
  };

  const toggle = async (s: ApiSourceRow) => {
    const sb = getSupabase();
    await sb.from('api_sources').update({ is_active: !s.is_active }).eq('id', s.id);
    void load();
  };

  const remove = async (s: ApiSourceRow) => {
    if (!window.confirm(`Xóa nguồn "${s.name}"?`)) return;
    const sb = getSupabase();
    await sb.from('api_sources').delete().eq('id', s.id);
    void load();
  };

  return (
    <div className="space-y-3">
      <div className={`${card} space-y-2`}>
        <p className="font-bold text-stone-900 dark:text-stone-100">
          {editingId ? 'Sửa nguồn API' : 'Thêm nguồn API mới'}
        </p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên nguồn (vd: TruyenOK 2)" className={inputCls} />
        <input
          value={openapiUrl}
          onChange={(e) => setOpenapiUrl(e.target.value)}
          placeholder="https://domain/api/v1/openapi.json"
          className={inputCls}
        />
        <div className="flex gap-2">
          <button onClick={() => void save()} className={btnPrimary}>
            {editingId ? 'Lưu' : 'Thêm'}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setName('');
                setOpenapiUrl('');
              }}
              className={btnGhost}
            >
              Hủy
            </button>
          )}
        </div>
      </div>

      {sources.map((s) => (
        <div key={s.id} className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-stone-900 dark:text-stone-100">
              {s.is_active ? '🟢' : '⚪'} {s.name}
            </p>
            <span className="text-xs text-stone-400">({s.id})</span>
            <div className="ml-auto flex flex-wrap gap-1">
              <button onClick={() => void check(s)} disabled={checking === s.id} className={btnGhost}>
                {checking === s.id ? '...' : '🔍 Kiểm tra'}
              </button>
              <button onClick={() => void toggle(s)} className={btnGhost}>
                {s.is_active ? 'Tắt' : 'Bật'}
              </button>
              <button
                onClick={() => {
                  setEditingId(s.id);
                  setName(s.name);
                  setOpenapiUrl(s.openapi_url);
                }}
                className={btnGhost}
              >
                Sửa
              </button>
              <button
                onClick={() => void remove(s)}
                className="rounded-full bg-red-100 px-4 py-1.5 text-sm font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300"
              >
                Xóa
              </button>
            </div>
          </div>
          <p className="mt-1 break-all text-xs text-stone-500 dark:text-stone-400">{s.openapi_url}</p>
          {s.base_url && <p className="text-xs text-stone-500 dark:text-stone-400">base: {s.base_url}</p>}
          {results[s.id] && <p className="mt-1 text-xs">{results[s.id]}</p>}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Thumbnail ---------------- */
function NovelThumbRow({
  novel,
  current,
  onSaved,
}: {
  novel: NovelSummary;
  current?: string;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [lastSource, setLastSource] = useState('');

  useEffect(() => {
    setUrl(current ?? '');
  }, [current]);

  const save = async (thumbUrl: string) => {
    const sb = getSupabase();
    const { error } = await sb.from('thumbnail_overrides').upsert(
      {
        source_id: novel.sourceId,
        novel_id: novel.id,
        thumbnail_url: thumbUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_id,novel_id' },
    );
    if (error) throw error;
    onSaved();
  };

  const saveUrl = async () => {
    if (!url.trim()) {
      alert('Nhập URL thumbnail.');
      return;
    }
    setBusy(true);
    try {
      await save(url.trim());
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lưu thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const sb = getSupabase();
    await sb
      .from('thumbnail_overrides')
      .delete()
      .eq('source_id', novel.sourceId)
      .eq('novel_id', novel.id);
    setUrl('');
    onSaved();
  };

  const genAI = async () => {
    if (busy) return;
    const keys = await getActiveKeys();
    const cf = await getCloudflareConfig().catch(() => null);
    const canGemini = keys.length > 0;
    const canCf = !!cf?.enabled && !!cf.worker_url.trim();
    if (!canGemini && !canCf) {
      alert(
        'Chưa có nguồn AI nào. Thêm Gemini key (tab 🤖 Gemini) hoặc cấu hình Cloudflare Worker ở mục ☁️ bên dưới nhé.',
      );
      return;
    }
    setBusy(true);
    try {
      // Gemini trước → lỗi/hết quota thì tự chuyển sang Cloudflare
      let blob: Blob | null = null;
      let used = '';
      let geminiErr = '';
      if (canGemini) {
        try {
          blob = await generateGeminiCover(novel.title, novel.author, novel.description);
          used = 'Gemini';
        } catch (e) {
          geminiErr = e instanceof Error ? e.message : 'lỗi không rõ';
        }
      }
      if (!blob) {
        if (!canCf) throw new Error(geminiErr || 'Gemini thất bại.');
        blob = await generateCloudflareCover(novel.title, novel.author, novel.description);
        used = 'Cloudflare';
      }
      const publicUrl = await uploadCover(blob, novel.sourceId, novel.id);
      setUrl(publicUrl);
      await save(publicUrl);
      setLastSource(used);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Tạo thumbnail thất bại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${card} flex gap-3`}>
      <img
        src={current || novel.coverUrl || ''}
        alt={novel.title}
        className="h-24 w-16 shrink-0 rounded-lg object-cover bg-stone-200 dark:bg-stone-800"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">{novel.title}</p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL thumbnail tùy chỉnh..."
          className={inputCls}
        />
        <div className="flex flex-wrap gap-1">
          <button onClick={() => void saveUrl()} disabled={busy} className={btnPrimary}>
            Lưu URL
          </button>
          <button onClick={() => void genAI()} disabled={busy} className={btnGhost}>
            {busy ? '...' : '✨ Tạo bằng AI'}
          </button>
          {lastSource && (
            <span className="self-center text-xs text-stone-500 dark:text-stone-400">
              Đã tạo bằng {lastSource}
            </span>
          )}
          {current && (
            <button onClick={() => void remove()} className={btnGhost}>
              Gỡ override
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Cấu hình Cloudflare Workers AI (nguồn ảnh dự phòng) ---------------- */
function CloudflareConfigCard() {
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getCloudflareConfig()
      .then((c) => {
        if (c) {
          setUrl(c.worker_url);
          setSecret(c.worker_secret);
          setEnabled(c.enabled);
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!url.trim()) {
      setMsg('Nhập Worker URL trước nhé.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await saveCloudflareConfig({ worker_url: url.trim(), worker_secret: secret.trim(), enabled });
      setMsg('Đã lưu cấu hình.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Lưu thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg('Đang kiểm tra (tốn 1 lượt quota)...');
    try {
      setMsg(await testCloudflareWorker());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kiểm tra thất bại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={card}>
      <p className="font-bold text-stone-900 dark:text-stone-100">
        ☁️ Cloudflare Workers AI{' '}
        <span className="text-xs font-normal text-stone-500 dark:text-stone-400">
          (dự phòng miễn phí — tự dùng khi Gemini lỗi/hết quota)
        </span>
      </p>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        Hướng dẫn lấy Worker URL + Secret: xem file{' '}
        <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">
          cloudflare-worker/HUONG-DAN.md
        </code>{' '}
        trong repo.
      </p>
      <div className="mt-2 space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Worker URL, ví dụ https://ten-worker.ten-tai-khoan.workers.dev"
          className={inputCls}
        />
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Worker Secret (chuỗi WORKER_SECRET đã đặt trong worker)"
          type="password"
          className={inputCls}
        />
        <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Bật nguồn Cloudflare
        </label>
        <div className="flex gap-2">
          <button onClick={() => void save()} disabled={busy} className={btnPrimary}>
            Lưu
          </button>
          <button onClick={() => void test()} disabled={busy} className={btnGhost}>
            {busy ? '...' : 'Kiểm tra kết nối'}
          </button>
        </div>
        {msg && <p className="text-xs text-stone-600 dark:text-stone-400">{msg}</p>}
      </div>
    </div>
  );
}

function ThumbnailsTab() {
  const [sources, setSources] = useState<ApiSourceRow[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [novels, setNovels] = useState<NovelSummary[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSupabase()
      .from('api_sources')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => {
        const list = (data ?? []) as ApiSourceRow[];
        setSources(list);
        if (list.length > 0) setSourceId(list[0].id);
      });
  }, []);

  const loadNovels = async (sid: string) => {
    const src = sources.find((s) => s.id === sid);
    if (!src) return;
    setLoading(true);
    try {
      const ns = await fetchNovels(src);
      const { data: ov } = await getSupabase()
        .from('thumbnail_overrides')
        .select('source_id,novel_id,thumbnail_url')
        .eq('source_id', sid);
      const map: Record<string, string> = {};
      for (const r of (ov ?? []) as { novel_id: string; thumbnail_url: string }[]) {
        map[r.novel_id] = r.thumbnail_url;
      }
      setNovels(ns);
      setOverrides(map);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Tải truyện thất bại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sourceId) void loadNovels(sourceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, sources.length]);

  const refreshOverrides = async () => {
    const { data: ov } = await getSupabase()
      .from('thumbnail_overrides')
      .select('source_id,novel_id,thumbnail_url')
      .eq('source_id', sourceId);
    const map: Record<string, string> = {};
    for (const r of (ov ?? []) as { novel_id: string; thumbnail_url: string }[]) {
      map[r.novel_id] = r.thumbnail_url;
    }
    setOverrides(map);
  };

  return (
    <div className="space-y-3">
      <CloudflareConfigCard />
      <div className={card}>
        <label className="text-sm font-medium">Nguồn truyện</label>
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={`${inputCls} mt-1`}>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {loading && <p className="text-sm text-stone-500">Đang tải danh sách truyện...</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {novels.map((n) => (
          <NovelThumbRow
            key={n.id}
            novel={n}
            current={overrides[n.id]}
            onSaved={() => void refreshOverrides()}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Vật phẩm ---------------- */
function ItemsTab() {
  const [items, setItems] = useState<CosmeticItem[]>([]);
  const [type, setType] = useState<'frame' | 'treasure'>('frame');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('50');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1.3);
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await getSupabase()
      .from('cosmetic_items')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data ?? []) as CosmeticItem[]);
  };
  useEffect(() => {
    void load();
  }, []);

  const onFile = (f: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const resetAdjust = () => {
    setScale(1.3);
    setOx(0);
    setOy(0);
  };

  const upload = async () => {
    if (!name.trim()) {
      alert('Nhập tên vật phẩm đã nhé.');
      return;
    }
    if (!file) {
      alert('Bạn chưa chọn ảnh — bấm nút "📁 Chọn ảnh" trước nhé.');
      return;
    }
    setUploading(true);
    try {
      const sb = getSupabase();
      const path = `items/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const { error: upErr } = await sb.storage
        .from('frames')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data } = sb.storage.from('frames').getPublicUrl(path);
      const { error: insErr } = await sb.from('cosmetic_items').insert({
        type,
        name: name.trim(),
        image_url: data.publicUrl,
        price: Math.max(0, parseInt(price, 10) || 0),
        scale,
        offset_x: ox,
        offset_y: oy,
      });
      if (insErr) throw insErr;
      setName('');
      setPrice('50');
      onFile(null);
      resetAdjust();
      void load();
      alert('Đã thêm vật phẩm!');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload thất bại.';
      if (/bucket not found/i.test(msg)) {
        alert(
          'Bucket "frames" chưa có trong Supabase.\nBạn mở Supabase → SQL Editor, chạy lại đoạn "Storage buckets" trong file supabase/schema.sql rồi thử lại nhé.',
        );
      } else {
        alert(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Xóa vật phẩm này?')) return;
    await getSupabase().from('cosmetic_items').delete().eq('id', id);
    void load();
  };

  return (
    <div className="space-y-3">
      <div className={`${card} grid gap-4 md:grid-cols-2`}>
        <div className="space-y-2">
          <p className="font-bold text-stone-900 dark:text-stone-100">Tải vật phẩm mới</p>
          <select value={type} onChange={(e) => setType(e.target.value as 'frame' | 'treasure')} className={inputCls}>
            <option value="frame">🖼️ Khung avatar</option>
            <option value="treasure">⚔️ Pháp bảo</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên vật phẩm" className={inputCls} />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
            placeholder="Giá linh thạch"
            inputMode="numeric"
            className={inputCls}
          />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-amber-700/40 px-4 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-400/40 dark:text-amber-300 dark:hover:bg-stone-800">
            📁 {file ? 'Đổi ảnh khác' : 'Chọn ảnh'}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          {file && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Đã chọn: <span className="font-semibold">{file.name}</span> (
              {Math.round(file.size / 1024)} KB)
            </p>
          )}
          <button onClick={() => void upload()} disabled={uploading} className={btnPrimary}>
            {uploading ? 'Đang tải lên...' : '⬆ Tải lên'}
          </button>
        </div>

        <div className="space-y-2">
          <p className="font-bold text-stone-900 dark:text-stone-100">Xem trước trực tiếp</p>
          <div className="relative mx-auto" style={{ width: 170, height: 170 }}>
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 font-display text-5xl text-white">
              M
            </div>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="preview"
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: 170 * scale,
                  height: 170 * scale,
                  transform: `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`,
                }}
              />
            )}
          </div>
          <label className="block text-xs text-stone-500">
            Kích thước: {scale.toFixed(2)}x
            <input type="range" min={0.5} max={2.5} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full" />
          </label>
          <label className="block text-xs text-stone-500">
            Ngang: {ox}px
            <input type="range" min={-100} max={100} step={1} value={ox} onChange={(e) => setOx(parseInt(e.target.value, 10))} className="w-full" />
          </label>
          <label className="block text-xs text-stone-500">
            Dọc: {oy}px
            <input type="range" min={-100} max={100} step={1} value={oy} onChange={(e) => setOy(parseInt(e.target.value, 10))} className="w-full" />
          </label>
          <button onClick={resetAdjust} className={btnGhost}>
            ↺ Đặt lại
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.id} className={card}>
            <div className="flex aspect-square items-center justify-center rounded-lg bg-stone-100 p-2 dark:bg-stone-800">
              <img src={it.image_url} alt={it.name} className="max-h-full max-w-full object-contain" loading="lazy" />
            </div>
            <p className="mt-2 truncate text-sm font-bold">{it.name}</p>
            <p className="text-xs text-stone-500">
              {it.type === 'frame' ? 'Khung' : 'Pháp bảo'} · 💎 {it.price}
            </p>
            <button
              onClick={() => void remove(it.id)}
              className="mt-1 text-xs text-red-600 hover:underline dark:text-red-400"
            >
              Xóa
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Thông báo thiên đạo ---------------- */
function AnnounceTab() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ id: string; message: string; created_at: string }[]>([]);

  const loadHistory = async () => {
    try {
      const sb = getSupabase();
      const { data } = await sb
        .from('announcements')
        .select('id, message, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      setHistory((data ?? []) as { id: string; message: string; created_at: string }[]);
    } catch {
      /* bỏ qua */
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const send = async () => {
    const msg = message.trim();
    if (!msg) {
      alert('Nhập nội dung thông báo đã bro.');
      return;
    }
    if (msg.length > 500) {
      alert('Thông báo tối đa 500 ký tự.');
      return;
    }
    setSending(true);
    try {
      const sb = getSupabase();
      const { error } = await sb.from('announcements').insert({ message: msg });
      if (error) throw error;
      setMessage('');
      await loadHistory();
      alert('📜 Đã ban "Thông báo thiên đạo" tới toàn thể tu sĩ đang online!');
    } catch (e) {
      alert(`Gửi thất bại: ${e instanceof Error ? e.message : 'lỗi không rõ'}`);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Xóa thông báo này?')) return;
    try {
      const sb = getSupabase();
      const { error } = await sb.from('announcements').delete().eq('id', id);
      if (error) throw error;
      await loadHistory();
    } catch (e) {
      alert(`Xóa thất bại: ${e instanceof Error ? e.message : 'lỗi không rõ'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="mb-1 font-bold text-stone-900 dark:text-stone-100">
          📢 Ban "Thông báo thiên đạo"
        </h3>
        <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
          Mọi tu sĩ đang online sẽ thấy popup ngay lập tức. Dùng để troll bạn bè cũng được 😏
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder='VD: alo — tối nay 8h công thành chiến, ai vắng phạt quét Tàng Kinh Các!'
          className={inputCls}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-stone-400">{message.length}/500</span>
          <button onClick={send} disabled={sending || !message.trim()} className={btnPrimary}>
            {sending ? 'Đang ban...' : '📜 Ban thông báo'}
          </button>
        </div>
      </div>

      <div className={card}>
        <h3 className="mb-2 font-bold text-stone-900 dark:text-stone-100">
          🕐 Lịch sử đã ban
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">Chưa có thông báo nào.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-start justify-between gap-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-800"
              >
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm text-stone-800 dark:text-stone-200">
                    {h.message}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    {new Date(h.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <button
                  onClick={() => remove(h.id)}
                  className="shrink-0 rounded-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-stone-700"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Nhân vật mới ---------------- */
function DefaultsTab() {
  const [stones, setStones] = useState('100');
  const [hours, setHours] = useState('0');
  const [frameId, setFrameId] = useState('');
  const [treasureId, setTreasureId] = useState('');
  const [items, setItems] = useState<CosmeticItem[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      const { data: d } = await sb.from('character_defaults').select('*').eq('id', 1).maybeSingle();
      if (d) {
        const row = d as { spirit_stones: number; reading_hours: number; frame_id: string | null; treasure_id: string | null };
        setStones(String(row.spirit_stones));
        setHours(String(row.reading_hours));
        setFrameId(row.frame_id ?? '');
        setTreasureId(row.treasure_id ?? '');
      }
      const { data: it } = await sb.from('cosmetic_items').select('*').order('name');
      setItems((it ?? []) as CosmeticItem[]);
    })();
  }, []);

  const save = async () => {
    const sb = getSupabase();
    const { error } = await sb.from('character_defaults').upsert({
      id: 1,
      spirit_stones: Math.max(0, parseInt(stones, 10) || 0),
      reading_hours: Math.max(0, parseFloat(hours) || 0),
      frame_id: frameId || null,
      treasure_id: treasureId || null,
    });
    if (error) alert(error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const frames = items.filter((i) => i.type === 'frame');
  const treasures = items.filter((i) => i.type === 'treasure');

  return (
    <div className={`${card} max-w-xl space-y-3`}>
      <p className="font-bold text-stone-900 dark:text-stone-100">
        🌱 Thông số mặc định khi có người tạo nhân vật mới
      </p>
      <label className="block text-sm">
        💎 Linh thạch khởi đầu
        <input value={stones} onChange={(e) => setStones(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${inputCls} mt-1`} />
      </label>
      <label className="block text-sm">
        ⏳ Giờ tu luyện khởi đầu (quy ra tu vi ban đầu)
        <input value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className={`${inputCls} mt-1`} />
      </label>
      <label className="block text-sm">
        🖼️ Khung avatar tặng sẵn
        <select value={frameId} onChange={(e) => setFrameId(e.target.value)} className={`${inputCls} mt-1`}>
          <option value="">— Không tặng —</option>
          {frames.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        ⚔️ Pháp bảo tặng sẵn
        <select value={treasureId} onChange={(e) => setTreasureId(e.target.value)} className={`${inputCls} mt-1`}>
          <option value="">— Không tặng —</option>
          {treasures.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button onClick={() => void save()} className={btnPrimary}>
        💾 Lưu cấu hình
      </button>
      {saved && <p className="text-sm text-green-600">✅ Đã lưu!</p>}
    </div>
  );
}

/* ---------------- Hệ thống ---------------- */
function SystemTab() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const test = async () => {
    setBusy(true);
    setStatus('Đang kiểm tra...');
    const t0 = performance.now();
    try {
      const sb = getSupabase();
      const { error, count } = await sb.from('api_sources').select('id', { count: 'exact', head: true });
      if (error) throw error;
      setStatus(`✅ Kết nối Supabase thành công (${Math.round(performance.now() - t0)}ms) · ${count ?? 0} nguồn API`);
    } catch (e) {
      setStatus(`❌ Kết nối thất bại: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${card} max-w-xl space-y-3`}>
      <p className="font-bold text-stone-900 dark:text-stone-100">🖥️ Trạng thái hệ thống</p>
      <p className="break-all text-sm text-stone-600 dark:text-stone-300">
        Supabase URL: <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">{getSupabaseUrl()}</code>
      </p>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Anon key được nạp từ biến môi trường <code>VITE_SUPABASE_ANON_KEY</code> (public-by-design,
        không hiển thị ở đây).
      </p>
      <button onClick={() => void test()} disabled={busy} className={btnPrimary}>
        {busy ? 'Đang kiểm tra...' : '🔍 Kiểm tra kết nối Supabase'}
      </button>
      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}

/* ---------------- Giao diện (Showcase 6 bộ Theme) ---------------- */
function ThemeTab() {
  const { template, setTemplate } = useTemplate();
  const [applying, setApplying] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  const apply = async (id: string) => {
    if (id === template) return;
    setApplying(id);
    setNote(null);
    try {
      await setTemplate(id);
      const def = getTemplateDef(id);
      setNote({ text: `Đã áp dụng thành công giao diện "${def.name}" cho toàn bộ website!`, ok: true });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : 'Áp dụng thất bại.', ok: false });
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🎨</span> 6 Bộ Giao Diện Website Hoàn Toàn Khác Biệt
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Chọn và kích hoạt bất kỳ giao diện nào dưới đây. Hệ thống sẽ áp dụng ngay lập tức cho toàn bộ độc giả (realtime sync qua database).
            </p>
          </div>
          <span className="rounded-xl bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            6 Phong Cách Độc Bản
          </span>
        </div>
      </div>

      {note && (
        <div
          className={`rounded-xl p-4 text-sm font-medium animate-fade-up ${
            note.ok
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {note.ok ? '✅' : '❌'} {note.text}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => {
          const active = template === t.id;
          const busy = applying === t.id;
          return (
            <div
              key={t.id}
              className={`flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 ${
                active
                  ? 'border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-900'
                  : 'border-slate-200/80 bg-white shadow-sm hover:border-slate-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              {/* Mockup Preview */}
              <div
                className="relative overflow-hidden p-4 border-b border-slate-100 dark:border-slate-800"
                style={{ background: t.swatches[2] }}
              >
                <div className="flex items-center justify-between rounded-lg bg-white/80 dark:bg-black/60 px-3 py-1.5 backdrop-blur-md shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">📚</span>
                    <span className="text-xs font-extrabold" style={{ color: t.swatches[0] }}>
                      Mê Truyện
                    </span>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold text-white shadow-xs"
                    style={{ background: t.swatches[0] }}
                  >
                    {t.id}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <div
                    className="h-20 flex-1 rounded-xl shadow-sm flex flex-col justify-end p-2"
                    style={{
                      background: `linear-gradient(135deg, ${t.swatches[0]}33, ${t.swatches[1]}88)`,
                    }}
                  >
                    <div className="h-2 w-3/4 rounded-full bg-white/70" />
                    <div className="mt-1 h-1.5 w-1/2 rounded-full bg-white/50" />
                  </div>
                  <div
                    className="h-20 flex-1 rounded-xl shadow-sm flex flex-col justify-end p-2"
                    style={{
                      background: `linear-gradient(135deg, ${t.swatches[1]}44, ${t.swatches[0]}77)`,
                    }}
                  >
                    <div className="h-2 w-2/3 rounded-full bg-white/70" />
                    <div className="mt-1 h-1.5 w-1/3 rounded-full bg-white/50" />
                  </div>
                </div>
              </div>

              {/* Thông tin mô tả & Swatches */}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {t.styleCategory}
                  </span>
                  {active && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Đang Dùng
                    </span>
                  )}
                </div>

                <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                  {t.name}
                </h4>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {t.tagline}
                </p>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex-1">
                  {t.desc}
                </p>

                {/* Swatches 4 ô màu */}
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-mono">Bảng màu:</span>
                  <div className="flex -space-x-1">
                    {t.swatches.map((c, i) => (
                      <span
                        key={i}
                        className="h-5 w-5 rounded-full border-2 border-white dark:border-slate-900 shadow-xs"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                {/* Nút hành động */}
                <button
                  onClick={() => void apply(t.id)}
                  disabled={busy || active}
                  className={`mt-4 w-full rounded-xl py-2.5 text-xs font-bold transition-all shadow-sm ${
                    active
                      ? 'bg-slate-100 text-slate-400 cursor-default dark:bg-slate-800 dark:text-slate-500'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-98 dark:bg-indigo-500 dark:hover:bg-indigo-600'
                  }`}
                >
                  {busy ? '⏳ Đang kích hoạt...' : active ? '✓ Giao diện đang kích hoạt' : 'Kích hoạt giao diện này'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Đồng bộ truyện từ API về database ---------------- */
interface SyncJobRow {
  id: string;
  kind: string;
  source_id: string | null;
  novel_key: string | null;
  status: string;
  total: number;
  done: number;
  skipped: number;
  error: string | null;
  heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
}

const JOB_KIND_LABEL: Record<string, string> = {
  'sync-novel': 'Đồng bộ chương',
  'sync-all': 'Đồng bộ tất cả',
  'check-updates': 'Kiểm tra cập nhật',
};

function SyncTab() {
  const [sources, setSources] = useState<ApiSourceRow[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [novels, setNovels] = useState<SyncedNovelRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyNovel, setBusyNovel] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const stopRef = useRef(false);

  /* ---------- Đồng bộ nền (Edge Function sync-worker) ---------- */
  const [jobs, setJobs] = useState<SyncJobRow[]>([]);
  const [bgBusy, setBgBusy] = useState(false);

  const loadJobs = async () => {
    try {
      const sb = getSupabase();
      const { data } = await sb
        .from('sync_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setJobs((data ?? []) as SyncJobRow[]);
    } catch {
      setJobs([]);
    }
  };

  const loadSources = async () => {
    const sb = getSupabase();
    const { data } = await sb.from('api_sources').select('*').order('created_at');
    const list = (data ?? []) as ApiSourceRow[];
    setSources(list);
    setSourceId((cur) => cur || list[0]?.id || '');
  };
  const loadNovels = async (sid: string) => {
    try {
      setNovels(await getSyncedNovels(sid));
    } catch {
      setNovels([]);
    }
  };
  useEffect(() => {
    void loadSources();
  }, []);
  useEffect(() => {
    if (sourceId) void loadNovels(sourceId);
  }, [sourceId]);
  useEffect(() => {
    void loadJobs();
    const sb = getSupabase();
    const ch = sb
      .channel('sync-jobs-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_jobs' }, (payload) => {
        void loadJobs();
        const row = payload.new as SyncJobRow | undefined;
        if ((row?.status === 'done' || row?.status === 'error') && row?.source_id) {
          void loadNovels(row.source_id);
        }
      })
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, []);

  const src = sources.find((s) => s.id === sourceId) ?? null;
  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleString('vi-VN', { hour12: false }) : '—';

  const doSyncList = async () => {
    if (!src || busy) return;
    setBusy(true);
    setSummary(null);
    try {
      const r = await syncNovelList(src);
      setSummary(
        `⬇ Đồng bộ danh sách xong: ${r.added} truyện mới, ${r.updated} truyện cập nhật (tổng ${r.total} từ API)` +
          (r.failed.length ? ` · ⚠️ ${r.failed.length} lỗi` : ''),
      );
      await loadNovels(src.id);
    } catch (e) {
      setSummary(`❌ ${e instanceof Error ? e.message : 'Lỗi không xác định.'}`);
    } finally {
      setBusy(false);
    }
  };

  const doCheck = async () => {
    if (!src || busy) return;
    setBusy(true);
    setSummary(null);
    try {
      const r = await checkUpdates(src);
      const parts: string[] = [];
      parts.push(
        r.newNovels.length > 0 ? `truyện mới: ${r.newNovels.join(', ')}` : 'không có truyện mới',
      );
      parts.push(
        r.updated.length > 0
          ? `cập nhật: ${r.updated.map((u) => `${u.title} (+${u.newChapters} chương)`).join('; ')}`
          : 'không có chương mới',
      );
      setSummary(
        `🔍 Kiểm tra cập nhật xong — ${parts.join(' · ')}` +
          (r.failed.length ? ` · ⚠️ ${r.failed.length} lỗi` : ''),
      );
      await loadNovels(src.id);
    } catch (e) {
      setSummary(`❌ ${e instanceof Error ? e.message : 'Lỗi không xác định.'}`);
    } finally {
      setBusy(false);
    }
  };

  const doSyncChapters = async (row: SyncedNovelRow) => {
    if (!src || busyNovel) return;
    setBusyNovel(row.id);
    stopRef.current = false;
    setProgress((p) => ({ ...p, [row.id]: 'bắt đầu...' }));
    try {
      const r = await syncChapters(
        src,
        row.id,
        (done, total, current) =>
          setProgress((p) => ({ ...p, [row.id]: `${done}/${total} · chương ${current}` })),
        () => stopRef.current,
      );
      setSummary(
        `📥 "${row.title}": +${r.synced} chương mới` +
          (r.skipped.length ? ` · bỏ qua ${r.skipped.length} chương lỗi` : '') +
          (r.stopped ? ' · đã dừng' : '') +
          (r.note ? ` · ${r.note}` : ''),
      );
      await loadNovels(src.id);
    } catch (e) {
      setSummary(`❌ "${row.title}": ${e instanceof Error ? e.message : 'Lỗi.'}`);
    } finally {
      setBusyNovel(null);
      setProgress((p) => {
        const n = { ...p };
        delete n[row.id];
        return n;
      });
    }
  };

  /* ----- Chạy nền qua Edge Function sync-worker (tắt tab vẫn chạy) ----- */
  const runInBackground = async (
    kind: 'sync-all' | 'check-updates' | 'sync-novel',
    novelKey?: string,
  ) => {
    if (!src || bgBusy) return;
    setBgBusy(true);
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('sync_jobs')
        .insert({ kind, source_id: src.id, novel_key: novelKey ?? null, status: 'pending' })
        .select('id')
        .single();
      if (error || !data) throw new Error(`Tạo job thất bại: ${error?.message ?? '?'}`);
      const jobId = (data as { id: string }).id;
      const { error: fnErr } = await sb.functions.invoke('sync-worker', {
        body: { job_id: jobId },
      });
      if (fnErr) throw fnErr;
      setSummary('▶ Đã bắt đầu chạy nền — tắt tab thoải mái, tiến trình cập nhật tự động bên dưới.');
      await loadJobs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định.';
      setSummary(
        `❌ Chạy nền thất bại: ${msg} — có thể Edge Function 'sync-worker' chưa được deploy. Xem README mục "Đồng bộ nền".`,
      );
    } finally {
      setBgBusy(false);
    }
  };

  const resumeJob = async (job: SyncJobRow) => {
    try {
      const sb = getSupabase();
      const { error } = await sb.functions.invoke('sync-worker', { body: { job_id: job.id } });
      if (error) throw error;
      setSummary('▶ Đã gửi lệnh tiếp tục job.');
    } catch (e) {
      setSummary(
        `❌ Không tiếp tục được: ${e instanceof Error ? e.message : 'lỗi'} — kiểm tra Edge Function 'sync-worker' đã deploy chưa (README mục "Đồng bộ nền").`,
      );
    }
  };

  const cancelJob = async (job: SyncJobRow) => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from('sync_jobs').update({ status: 'cancelled' }).eq('id', job.id);
      if (error) throw error;
      await loadJobs();
    } catch {
      /* bỏ qua */
    }
  };

  const jobStalled = (j: SyncJobRow) => {
    if (j.status !== 'running') return false;
    const hb = j.heartbeat_at ?? j.updated_at;
    return Date.now() - new Date(hb).getTime() > 10 * 60 * 1000;
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return '—';
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s} giây trước`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} giờ trước`;
    return `${Math.floor(h / 24)} ngày trước`;
  };

  const jobTitle = (j: SyncJobRow) => {
    const kindLabel = JOB_KIND_LABEL[j.kind] ?? j.kind;
    const novel = j.novel_key ? novels.find((n) => n.id === j.novel_key) : null;
    return novel ? `${kindLabel}: ${novel.title}` : kindLabel;
  };

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = {
      pending: 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200',
      running: 'animate-pulse bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      cancelled: 'bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400',
    };
    const label =
      { pending: 'Chờ', running: 'Đang chạy', done: 'Xong', error: 'Lỗi', cancelled: 'Đã hủy' }[
        s
      ] ?? s;
    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls[s] ?? cls.pending}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-2`}>
        <label className="text-sm font-semibold text-stone-700 dark:text-stone-300">
          Nguồn API:
        </label>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className={`${inputCls} w-auto`}
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button onClick={() => void doSyncList()} disabled={busy || !src} className={btnPrimary}>
          {busy ? 'Đang chạy...' : '⬇ Đồng bộ danh sách truyện'}
        </button>
        <button
          onClick={() => void runInBackground('sync-all')}
          disabled={bgBusy || !src}
          className={btnGhost}
          title="Chạy trên server: đồng bộ danh sách + TẤT CẢ chương. Tắt tab vẫn chạy."
        >
          {bgBusy ? '...' : '▶ Chạy nền: tất cả'}
        </button>
        <button onClick={() => void doCheck()} disabled={busy || !src} className={btnGhost}>
          {busy ? 'Đang chạy...' : '🔍 Kiểm tra cập nhật'}
        </button>
        <button
          onClick={() => void runInBackground('check-updates')}
          disabled={bgBusy || !src}
          className={btnGhost}
          title="Chạy trên server: chỉ lấy truyện mới / chương mới. Tắt tab vẫn chạy."
        >
          {bgBusy ? '...' : '▶ Chạy nền'}
        </button>
      </div>

      {summary && (
        <p className="rounded-xl border border-amber-900/15 bg-amber-50 px-4 py-2 text-sm text-stone-700 dark:border-amber-100/10 dark:bg-stone-800 dark:text-stone-200">
          {summary}
        </p>
      )}

      <div className={card}>
        <h3 className="font-bold text-stone-900 dark:text-stone-100">
          📚 Truyện đã đồng bộ ({novels.length})
        </h3>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Bấm "Đồng bộ chương" để tải nội dung từng chương về database — tự bỏ qua chương đã
          có, chương lỗi sẽ được bỏ qua và tiếp tục. Truyện dài 1000+ chương có thể mất vài
          phút: dùng nút "▶ Nền" để chạy trên server, tắt tab vẫn xong.
        </p>
        <div className="mt-3 space-y-2">
          {novels.map((n) => {
            // API có truyện báo translated_count=0 nhưng vẫn có nội dung → dùng max()
            const total = Math.max(n.translated_count || 0, n.chapters_count || 0);
            const done = Math.min(n.synced_chapters, total);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const running = busyNovel === n.id;
            return (
              <div
                key={n.id}
                className="rounded-xl border border-amber-900/10 p-3 dark:border-amber-100/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-semibold text-stone-900 dark:text-stone-100">
                    {n.title}
                  </p>
                  {running ? (
                    <button onClick={() => (stopRef.current = true)} className={btnGhost}>
                      ⏹ Dừng
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => void doSyncChapters(n)}
                        disabled={busyNovel !== null}
                        className={btnPrimary}
                      >
                        ⬇ Đồng bộ chương
                      </button>
                      <button
                        onClick={() => void runInBackground('sync-novel', n.id)}
                        disabled={busyNovel !== null || bgBusy}
                        className={btnGhost}
                        title="Chạy trên server — tắt tab vẫn chạy."
                      >
                        ▶ Nền
                      </button>
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                    <div
                      className="h-full rounded-full bg-amber-600 transition-all dark:bg-amber-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="whitespace-nowrap">
                    {running && progress[n.id] ? progress[n.id] : `đã sync ${done}/${total} chương`}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">
                  Lần cuối: {fmtDate(n.last_synced_at)}
                </p>
              </div>
            );
          })}
          {novels.length === 0 && (
            <p className="py-6 text-center text-sm italic text-stone-500 dark:text-stone-400">
              Chưa có truyện nào trong database. Bấm "⬇ Đồng bộ danh sách truyện" để bắt đầu.
            </p>
          )}
        </div>
      </div>

      <div className={card}>
        <h3 className="font-bold text-stone-900 dark:text-stone-100">
          ⚙️ Tiến trình nền ({jobs.length})
        </h3>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Job chạy trên server (Edge Function) — tắt tab trình duyệt vẫn tiếp tục. Tiến trình cập
          nhật tự động theo thời gian thực.
        </p>
        <div className="mt-3 space-y-2">
          {jobs.map((j) => {
            const pct = j.total > 0 ? Math.round((Math.min(j.done, j.total) / j.total) * 100) : 0;
            const stalled = jobStalled(j);
            return (
              <div
                key={j.id}
                className="rounded-xl border border-amber-900/10 p-3 dark:border-amber-100/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-semibold text-stone-900 dark:text-stone-100">
                    {jobTitle(j)}
                  </p>
                  {statusBadge(j.status)}
                  {stalled && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      ⏳ Đứng quá 10 phút
                    </span>
                  )}
                  {(j.status === 'running' || j.status === 'pending') && (
                    <button onClick={() => void cancelJob(j)} className={btnGhost}>
                      ✕ Hủy
                    </button>
                  )}
                  {(j.status === 'error' || stalled) && (
                    <button onClick={() => void resumeJob(j)} className={btnPrimary}>
                      ▶ Tiếp tục
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="whitespace-nowrap">
                    {j.done}/{j.total}
                    {j.skipped > 0 ? ` · bỏ qua ${j.skipped}` : ''}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">
                  Cập nhật: {timeAgo(j.heartbeat_at ?? j.updated_at)}
                  {j.error ? ` · ❌ ${j.error}` : ''}
                </p>
              </div>
            );
          })}
          {jobs.length === 0 && (
            <p className="py-4 text-center text-sm italic text-stone-500 dark:text-stone-400">
              Chưa có job nền nào. Bấm "▶ Chạy nền" ở trên để bắt đầu.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Gemini API keys (dịch thuật) ---------------- */
interface GeminiKeyRow {
  id: string;
  label: string;
  api_key: string;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
}

function maskKey(k: string): string {
  return k.length > 7 ? `${k.slice(0, 7)}…` : '••••••';
}

function GeminiTab() {
  const [keys, setKeys] = useState<GeminiKeyRow[]>([]);
  const [label, setLabel] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadKeys = async () => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from('gemini_keys').select('*').order('created_at');
      if (error) throw error;
      setKeys((data ?? []) as GeminiKeyRow[]);
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Không tải được danh sách key.'}`);
    }
  };
  useEffect(() => {
    void loadKeys();
  }, []);

  const addKey = async () => {
    if (busy) return;
    if (!label.trim()) {
      setMsg('❌ Nhập tên gợi nhớ cho key.');
      return;
    }
    if (!keyInput.trim()) {
      setMsg('❌ Nhập API key.');
      return;
    }
    setBusy(true);
    setMsg('🔍 Đang kiểm tra kết nối key...');
    try {
      const ok = await testGeminiKey(keyInput);
      if (!ok) {
        setMsg('❌ Key không hoạt động (sai key hoặc bị chặn). Key chưa được lưu.');
        return;
      }
      const sb = getSupabase();
      const { error } = await sb.from('gemini_keys').insert({
        label: label.trim(),
        api_key: keyInput.trim(),
        is_active: true,
        last_tested_at: new Date().toISOString(),
        last_test_ok: true,
      });
      if (error) throw error;
      setLabel('');
      setKeyInput('');
      setMsg('✅ Key hoạt động — đã lưu vào database.');
      await loadKeys();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Lưu key thất bại.'}`);
    } finally {
      setBusy(false);
    }
  };

  const retest = async (k: GeminiKeyRow) => {
    setTestingId(k.id);
    try {
      const ok = await testGeminiKey(k.api_key);
      const sb = getSupabase();
      await sb
        .from('gemini_keys')
        .update({ last_tested_at: new Date().toISOString(), last_test_ok: ok })
        .eq('id', k.id);
      setMsg(ok ? `✅ Key "${k.label}" vẫn hoạt động.` : `❌ Key "${k.label}" không còn hoạt động.`);
      await loadKeys();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Kiểm tra thất bại.'}`);
    } finally {
      setTestingId(null);
    }
  };

  const toggleActive = async (k: GeminiKeyRow) => {
    const sb = getSupabase();
    await sb.from('gemini_keys').update({ is_active: !k.is_active }).eq('id', k.id);
    await loadKeys();
  };

  const removeKey = async (k: GeminiKeyRow) => {
    if (!window.confirm(`Xóa key "${k.label}"?`)) return;
    const sb = getSupabase();
    await sb.from('gemini_keys').delete().eq('id', k.id);
    await loadKeys();
  };

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleString('vi-VN', { hour12: false }) : '—';

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-bold text-stone-900 dark:text-stone-100">➕ Thêm Gemini API key</p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Lấy key miễn phí tại Google AI Studio (aistudio.google.com). Key được kiểm tra kết nối
          trước khi lưu — key lỗi sẽ không lưu vào database.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input
            className={inputCls}
            placeholder="Tên gợi nhớ (vd: key chính)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className={`${inputCls} font-mono`}
            placeholder="Dán Gemini API key (AIza...)"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            type="password"
          />
          <button onClick={() => void addKey()} disabled={busy} className={btnPrimary}>
            {busy ? 'Đang kiểm tra...' : '🔍 Kiểm tra & Lưu'}
          </button>
        </div>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </div>

      <div className={card}>
        <p className="font-bold text-stone-900 dark:text-stone-100">
          🔑 Danh sách key ({keys.filter((k) => k.is_active).length} đang bật / {keys.length})
        </p>
        <div className="mt-3 space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-900/10 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-100/10 dark:bg-stone-800/60"
            >
              <span className="font-bold">{k.label}</span>
              <code className="rounded bg-stone-200/70 px-1.5 py-0.5 font-mono text-xs dark:bg-stone-700">
                {maskKey(k.api_key)}
              </code>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  k.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
                }`}
              >
                {k.is_active ? 'đang bật' : 'đang tắt'}
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {k.last_test_ok === null
                  ? 'chưa test'
                  : k.last_test_ok
                    ? `✅ OK · ${fmtDate(k.last_tested_at)}`
                    : `❌ lỗi · ${fmtDate(k.last_tested_at)}`}
              </span>
              <span className="ml-auto flex gap-1">
                <button
                  onClick={() => void retest(k)}
                  disabled={testingId === k.id}
                  className={btnGhost}
                  title="Kiểm tra lại kết nối"
                >
                  {testingId === k.id ? '…' : '🔍'}
                </button>
                <button onClick={() => void toggleActive(k)} className={btnGhost} title="Bật/tắt">
                  {k.is_active ? '⏸' : '▶'}
                </button>
                <button onClick={() => void removeKey(k)} className={btnGhost} title="Xóa key">
                  🗑
                </button>
              </span>
            </div>
          ))}
          {keys.length === 0 && (
            <p className="py-4 text-center text-sm italic text-stone-500 dark:text-stone-400">
              Chưa có key nào. Thêm key ở trên để dùng chức năng dịch.
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          ℹ️ Key lưu trong database, chỉ admin đọc được. Trình duyệt gọi thẳng API Gemini khi dịch;
          key lỗi/hết quota sẽ tự xoay sang key khác còn bật.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Nhập truyện thủ công ---------------- */
interface ParsedChapter {
  num: number;
  title: string;
  content: string;
}

function parseChapters(text: string): ParsedChapter[] {
  const re = /^===\s*Chương\s+(\d+)\s*:?\s*(.*?)\s*===\s*$/gim;
  const matches = [...text.matchAll(re)];
  const out: ParsedChapter[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    out.push({
      num: parseInt(m[1], 10),
      title: m[2]?.trim() ? m[2].trim() : `Chương ${m[1]}`,
      content: text.slice(start, end).trim(),
    });
  }
  return out
    .filter((c) => c.content.length > 0)
    .sort((a, b) => a.num - b.num);
}

function formatChapters(cs: ParsedChapter[]): string {
  return cs.map((c) => `=== Chương ${c.num}: ${c.title} ===\n${c.content}`).join('\n\n');
}

/* dùng slugify() có sẵn trong file */

const CHAPTER_FORMAT_HINT = `=== Chương 1: Tiêu đề chương ===
Nội dung chương 1...

=== Chương 2: Tiêu đề chương ===
Nội dung chương 2...`;

function ImportTab() {
  const [novels, setNovels] = useState<SyncedNovelRow[]>([]);
  // form tạo truyện
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [desc, setDesc] = useState('');
  const [cover, setCover] = useState('');
  // nhập chương
  const [selectedId, setSelectedId] = useState('');
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [transProgress, setTransProgress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadNovels = async () => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('synced_novels')
        .select('*')
        .eq('source_id', 'manual')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as SyncedNovelRow[];
      setNovels(list);
      setSelectedId((cur) => cur || list[0]?.id || '');
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Không tải được danh sách truyện.'}`);
    }
  };
  useEffect(() => {
    void loadNovels();
  }, []);

  const parsed = parseChapters(bulk);

  const createNovel = async () => {
    if (busy) return;
    if (!title.trim()) {
      setMsg('❌ Nhập tên truyện.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const apiId = `${slugify(title)}-${Date.now()}`;
      const id = `manual:${apiId}`;
      const sb = getSupabase();
      const { error } = await sb.from('synced_novels').insert({
        id,
        source_id: 'manual',
        api_id: apiId,
        title: title.trim(),
        author: author.trim() || null,
        description: desc.trim() || null,
        cover_url: cover.trim() || null,
        status: 'ongoing',
        chapters_count: 0,
        translated_count: 0,
        synced_chapters: 0,
      });
      if (error) throw error;
      setTitle('');
      setAuthor('');
      setDesc('');
      setCover('');
      setMsg('✅ Đã tạo truyện. Chọn truyện ở bước 2 để nhập chương.');
      await loadNovels();
      setSelectedId(id);
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Tạo truyện thất bại.'}`);
    } finally {
      setBusy(false);
    }
  };

  const translateAll = async () => {
    if (translating || saving) return;
    const ps = parseChapters(bulk);
    if (ps.length === 0) {
      setMsg('❌ Không parse được chương nào. Kiểm tra lại format.');
      return;
    }
    setTranslating(true);
    setMsg(null);
    try {
      const done: ParsedChapter[] = [];
      for (let i = 0; i < ps.length; i++) {
        setTransProgress(`Đang dịch chương ${ps[i].num} (${i + 1}/${ps.length})...`);
        const t = await translateText(ps[i].content);
        done.push({ ...ps[i], content: t });
      }
      setBulk(formatChapters(done));
      setMsg(
        `✅ Đã dịch xong ${done.length} chương — kiểm tra/sửa lại nội dung rồi bấm "💾 Lưu vào database".`,
      );
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Dịch thất bại.'}`);
    } finally {
      setTranslating(false);
      setTransProgress(null);
    }
  };

  const saveChapters = async () => {
    if (saving || translating) return;
    if (!selectedId) {
      setMsg('❌ Chọn truyện ở bước 2.');
      return;
    }
    const ps = parseChapters(bulk);
    if (ps.length === 0) {
      setMsg('❌ Không parse được chương nào.');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const sb = getSupabase();
      for (const c of ps) {
        const { error } = await sb.from('synced_chapters').upsert(
          { novel_id: selectedId, chapter_number: c.num, title: c.title, content: c.content },
          { onConflict: 'novel_id,chapter_number' },
        );
        if (error) throw error;
      }
      const { data: all } = await sb
        .from('synced_chapters')
        .select('chapter_number')
        .eq('novel_id', selectedId);
      const nums = ((all ?? []) as { chapter_number: number }[]).map((r) => r.chapter_number);
      const maxNum = nums.length ? Math.max(...nums) : 0;
      await sb
        .from('synced_novels')
        .update({
          synced_chapters: nums.length,
          translated_count: maxNum,
          chapters_count: maxNum,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', selectedId);
      setMsg(`✅ Đã lưu ${ps.length} chương vào database.`);
      await loadNovels();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Lưu thất bại.'}`);
    } finally {
      setSaving(false);
    }
  };

  const removeNovel = async (n: SyncedNovelRow) => {
    if (!window.confirm(`Xóa truyện "${n.title}" và toàn bộ chương đã lưu?`)) return;
    const sb = getSupabase();
    await sb.from('synced_novels').delete().eq('id', n.id);
    if (selectedId === n.id) setSelectedId('');
    await loadNovels();
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-bold text-stone-900 dark:text-stone-100">📖 Bước 1 — Tạo truyện</p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Chỉ nhập nội dung bạn có quyền sử dụng (truyện tự sáng tác, bản dịch của bạn, hoặc tác
          phẩm miễn phí/không bản quyền).
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className={inputCls}
            placeholder="Tên truyện *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Tác giả"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <input
            className={`${inputCls} sm:col-span-2`}
            placeholder="Link ảnh bìa (tùy chọn)"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
          />
          <textarea
            className={`${inputCls} min-h-20 sm:col-span-2`}
            placeholder="Mô tả truyện (tùy chọn)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <button onClick={() => void createNovel()} disabled={busy} className={`${btnPrimary} mt-3`}>
          {busy ? 'Đang tạo...' : '➕ Tạo truyện'}
        </button>
      </div>

      <div className={card}>
        <p className="font-bold text-stone-900 dark:text-stone-100">📝 Bước 2 — Nhập chương</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className={`${inputCls} max-w-xs`}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— Chọn truyện —</option>
            {novels.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title} ({n.synced_chapters} chương đã lưu)
              </option>
            ))}
          </select>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {parsed.length > 0
              ? `Đã nhận diện ${parsed.length} chương: ${parsed
                  .slice(0, 6)
                  .map((c) => c.num)
                  .join(', ')}${parsed.length > 6 ? '…' : ''}`
              : 'Dán nhiều chương theo format bên dưới'}
          </span>
        </div>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-100 p-3 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
          {CHAPTER_FORMAT_HINT}
        </pre>
        <textarea
          className={`${inputCls} mt-2 min-h-64 font-mono`}
          placeholder="Dán nội dung các chương theo format trên..."
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void translateAll()}
            disabled={translating || saving || parsed.length === 0}
            className={btnPrimary}
          >
            {translating ? '⏳ Đang dịch...' : '🤖 Dịch tất cả bằng Gemini'}
          </button>
          <button
            onClick={() => void saveChapters()}
            disabled={saving || translating || parsed.length === 0 || !selectedId}
            className={btnPrimary}
          >
            {saving ? '⏳ Đang lưu...' : '💾 Lưu vào database'}
          </button>
        </div>
        {transProgress && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{transProgress}</p>
        )}
        {msg && <p className="mt-2 text-sm">{msg}</p>}
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          💡 Dịch xong nội dung sẽ hiện lại trong ô trên để bạn kiểm tra/sửa trước khi lưu. Nút
          dịch chống bấm đúp; mỗi lần dịch nên kiểm tra key còn quota trong tab 🤖 Gemini.
        </p>
      </div>

      <div className={card}>
        <p className="font-bold text-stone-900 dark:text-stone-100">
          📚 Truyện đã nhập tay ({novels.length})
        </p>
        <div className="mt-3 space-y-2">
          {novels.map((n) => (
            <div
              key={n.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-900/10 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-100/10 dark:bg-stone-800/60"
            >
              <span className="font-bold">{n.title}</span>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {n.synced_chapters} chương đã lưu
              </span>
              <span className="ml-auto">
                <button onClick={() => void removeNovel(n)} className={btnGhost} title="Xóa truyện">
                  🗑
                </button>
              </span>
            </div>
          ))}
          {novels.length === 0 && (
            <p className="py-4 text-center text-sm italic text-stone-500 dark:text-stone-400">
              Chưa có truyện nào. Tạo truyện ở bước 1.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- SaaS Admin Layout Chuyên Nghiệp ---------------- */
interface TabGroupItem {
  id: Tab;
  label: string;
  icon: string;
  desc: string;
  badge?: string;
}

interface TabGroup {
  groupName: string;
  items: TabGroupItem[];
}

const TAB_GROUPS: TabGroup[] = [
  {
    groupName: 'BẢNG ĐIỀU KHIỂN',
    items: [
      { id: 'overview', label: 'Tổng quan & KPI', icon: '📊', desc: 'Thống kê tổng thể hoạt động, người dùng và dữ liệu' },
    ],
  },
  {
    groupName: 'NỘI DUNG & THƯ VIỆN',
    items: [
      { id: 'chapters', label: 'Quản lý chương', icon: '📝', desc: 'Quản lý, biên tập và sửa chương truyện đã lưu' },
      { id: 'import', label: 'Nhập truyện thủ công', icon: '✍️', desc: 'Thêm truyện mới và nạp hàng loạt chương tự động' },
      { id: 'sources', label: 'Nguồn API Crawl', icon: '🔗', desc: 'Cấu hình OpenAPI nguồn truyện và máy chủ trung gian' },
      { id: 'sync', label: 'Đồng bộ dữ liệu', icon: '🔄', desc: 'Đồng bộ danh sách truyện và tải chương về database' },
      { id: 'glossary', label: 'Từ điển dịch thuật', icon: '📖', desc: 'Quy tắc thay thế thuật ngữ tu tiên và danh từ riêng' },
    ],
  },
  {
    groupName: 'TRÍ TUỆ NHÂN TẠO',
    items: [
      { id: 'gemini', label: 'Gemini AI API Keys', icon: '🤖', desc: 'Quản lý danh sách API Key Google AI Studio & xoay vòng' },
      { id: 'thumbnails', label: 'AI Studio & Cloudflare', icon: '🖼️', desc: 'Tạo ảnh bìa tự động bằng Cloudflare Workers AI' },
    ],
  },
  {
    groupName: 'HỆ THỐNG TU TIÊN',
    items: [
      { id: 'users', label: 'Thành viên & Cảnh giới', icon: '👥', desc: 'Quản lý tài khoản, điều chỉnh tu vi và linh thạch' },
      { id: 'items', label: 'Tàng Bảo Các & Vật phẩm', icon: '⚔️', desc: 'Thiết lập danh hiệu, khung avatar và pháp bảo' },
      { id: 'defaults', label: 'Tân thủ mặc định', icon: '🌱', desc: 'Cấu hình vật phẩm và quà tặng khi tạo nhân vật mới' },
      { id: 'announce', label: 'Thiên Đạo Lệnh thông báo', icon: '📢', desc: 'Phát thông báo chạy chữ toàn trang web' },
    ],
  },
  {
    groupName: 'CẤU HÌNH & HỆ THỐNG',
    items: [
      { id: 'theme', label: '6 Bộ Giao Diện', icon: '🎨', desc: 'Quản lý và kích hoạt 6 phong cách thiết kế độc bản', badge: '6 Skins' },
      { id: 'system', label: 'Thông tin hệ thống', icon: '🖥️', desc: 'Kiểm tra hạ tầng Cloudflare, Supabase và cấu hình máy chủ' },
    ],
  },
];

export default function Admin() {
  const { isAdmin, profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <span className="text-5xl">⛔</span>
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Truy cập bị từ chối</h2>
        <p className="mt-1 text-sm text-slate-500">Khu vực này yêu cầu đặc quyền Quản trị viên (Admin).</p>
        <a href="/" className="mt-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Quay về trang chủ
        </a>
      </div>
    );
  }

  // Tìm tab hiện tại để lấy thông tin nhóm & mô tả
  let currentTabItem: TabGroupItem = TAB_GROUPS[0].items[0];
  let currentGroupName = TAB_GROUPS[0].groupName;
  for (const group of TAB_GROUPS) {
    const found = group.items.find((i) => i.id === tab);
    if (found) {
      currentTabItem = found;
      currentGroupName = group.groupName;
      break;
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      {/* Brand Workspace Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-xl font-black text-white shadow-md shadow-indigo-500/25">
          ⚡
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-black tracking-wide text-white">MÊ TRUYỆN SAAS</h2>
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-400">
              PRO
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Cloud Console v1.0</p>
        </div>
      </div>

      {/* Nav Menu Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {TAB_GROUPS.map((g) => (
          <div key={g.groupName}>
            <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {g.groupName}
            </p>
            <div className="mt-1.5 space-y-0.5">
              {g.items.map((i) => {
                const active = tab === i.id;
                return (
                  <button
                    key={i.id}
                    onClick={() => {
                      setTab(i.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm">{i.icon}</span>
                      <span>{i.label}</span>
                    </div>
                    {i.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                        }`}
                      >
                        {i.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Admin User Footer */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-white">
            {profile?.username?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{profile?.username}</p>
            <p className="text-[10px] text-slate-400">Quản Trị Viên Toàn Quyền</p>
          </div>
          <button
            onClick={() => void signOut()}
            title="Đăng xuất quản trị"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 transition"
          >
            🚪
          </button>
          <a
            href="/"
            title="Mở website trong tab mới"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            ↗
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-65px)] bg-slate-50 dark:bg-slate-950/70 font-sans">
      {/* Sidebar Desktop cố định */}
      <aside className="hidden w-64 shrink-0 lg:block border-r border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="sticky top-16 h-[calc(100vh-65px)]">
          {sidebarContent}
        </div>
      </aside>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main SaaS Canvas Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        {/* Topbar Action Bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 lg:hidden"
            >
              ☰
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Console</span>
                <span>/</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {currentGroupName}
                </span>
                <span>/</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                  {currentTabItem.label}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>{currentTabItem.icon}</span>
                <span>{currentTabItem.label}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Cluster: Bình thường
            </span>
            <a
              href="/"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition"
            >
              Xem Website ↗
            </a>
          </div>
        </div>

        {/* Tab Description Subtitle */}
        <p className="mb-6 text-xs text-slate-500 dark:text-slate-400">
          {currentTabItem.desc}
        </p>

        {/* Dynamic Tab Body Component */}
        <div className="animate-fade-up">
          {tab === 'overview' && <OverviewTab onSelectTab={(t) => setTab(t)} />}
          {tab === 'users' && <UsersTab />}
          {tab === 'sources' && <SourcesTab />}
          {tab === 'sync' && <SyncTab />}
          {tab === 'chapters' && <ChapterManager />}
          {tab === 'glossary' && <GlossaryManager />}
          {tab === 'gemini' && <GeminiTab />}
          {tab === 'import' && <ImportTab />}
          {tab === 'thumbnails' && <ThumbnailsTab />}
          {tab === 'items' && <ItemsTab />}
          {tab === 'defaults' && <DefaultsTab />}
          {tab === 'theme' && <ThemeTab />}
          {tab === 'announce' && <AnnounceTab />}
          {tab === 'system' && <SystemTab />}
        </div>
      </main>
    </div>
  );
}

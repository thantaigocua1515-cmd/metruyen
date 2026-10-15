import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { getSupabase, getSupabaseUrl } from '../lib/supabase';
import { fetchOpenApiInfo, fetchNovels } from '../lib/novelApi';
import type { ApiSourceRow, NovelSummary } from '../lib/novelApi';
import { syncNovelList, syncChapters, checkUpdates } from '../lib/sync';
import { getSyncedNovels } from '../lib/library';
import type { SyncedNovelRow } from '../lib/library';
import { generateCover, generateAICover, uploadCover } from '../components/CoverGenerator';
import type { CosmeticItem } from '../components/Treasury';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';
import { TEMPLATES, getTemplateDef } from '../theme/templates';

type Tab = 'overview' | 'users' | 'sources' | 'sync' | 'thumbnails' | 'items' | 'defaults' | 'theme' | 'system';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: '📊 Tổng quan' },
  { id: 'users', label: '👥 Người dùng' },
  { id: 'sources', label: '🔗 Nguồn API' },
  { id: 'sync', label: '🔄 Đồng bộ' },
  { id: 'thumbnails', label: '🖼️ Thumbnail' },
  { id: 'items', label: '⚔️ Vật phẩm' },
  { id: 'defaults', label: '🌱 Nhân vật mới' },
  { id: 'theme', label: '🎨 Giao diện' },
  { id: 'system', label: '🖥️ Hệ thống' },
];

const card =
  'rounded-xl border border-amber-900/15 bg-white p-4 shadow-sm dark:border-amber-100/10 dark:bg-stone-900';
const inputCls =
  'w-full rounded-xl border border-amber-900/20 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-amber-100/15 dark:bg-stone-800 dark:text-stone-100';
const btnPrimary =
  'rounded-full bg-amber-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-600 dark:hover:bg-amber-500';
const btnGhost =
  'rounded-full border border-amber-900/20 px-4 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-100/15 dark:text-amber-300 dark:hover:bg-stone-800';

/* ---------------- Tổng quan ---------------- */
function OverviewTab() {
  const [stats, setStats] = useState({ users: 0, hours: 0, shelf: 0, sources: 0, items: 0 });
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
  const cells: [string, string][] = [
    ['👥 Người dùng', String(stats.users)],
    ['⏳ Tổng giờ đọc', `${stats.hours}h`],
    ['📚 Lượt lưu tủ', String(stats.shelf)],
    ['🔗 Nguồn API', String(stats.sources)],
    ['⚔️ Vật phẩm', String(stats.items)],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cells.map(([label, value]) => (
        <div key={label} className={`${card} text-center`}>
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{value}</p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{label}</p>
        </div>
      ))}
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
    setBusy(true);
    try {
      // Ưu tiên ảnh AI (Pollinations, miễn phí); bận/lỗi thì dùng bản vẽ canvas
      let blob: Blob;
      let usedFallback = false;
      try {
        blob = await generateAICover(novel.title, novel.author);
      } catch {
        usedFallback = true;
        blob = await generateCover(novel.title, novel.author);
      }
      const publicUrl = await uploadCover(blob, novel.sourceId, novel.id);
      setUrl(publicUrl);
      await save(publicUrl);
      if (usedFallback) {
        alert('AI đang bận nên đã tạo bìa bằng bản vẽ canvas. Thử lại sau để dùng ảnh AI nhé.');
      }
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

/* ---------------- Giao diện (chọn template) ---------------- */
function ThemeTab() {
  const { template, setTemplate } = useTemplate();
  const [applying, setApplying] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const apply = async (id: string) => {
    if (id === template) return;
    setApplying(id);
    setNote(null);
    try {
      await setTemplate(id);
      const def = getTemplateDef(id);
      setNote(`✅ Đã áp dụng template "${def.name}" cho toàn site.`);
    } catch (e) {
      setNote(`❌ ${e instanceof Error ? e.message : 'Áp dụng thất bại.'}`);
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className={card}>
        <p className="font-bold text-stone-900 dark:text-stone-100">🎨 Template giao diện</p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Đổi là áp dụng ngay cho toàn bộ website (lưu ở bảng{' '}
          <code>site_settings</code>, realtime tới mọi máy đang mở).
        </p>
      </div>
      {note && <p className="text-sm">{note}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => {
          const active = template === t.id;
          const busy = applying === t.id;
          return (
            <div
              key={t.id}
              className={`${card} ${active ? 'ring-2' : ''}`}
              style={active ? ({ ['--tw-ring-color' as string]: 'var(--brand)' } as CSSProperties) : undefined}
            >
              {/* mock preview nhỏ */}
              <div
                className="overflow-hidden rounded-lg"
                style={{ background: 'var(--page-bg)', border: '1px solid color-mix(in srgb, var(--ink) 12%, transparent)' }}
              >
                <div
                  className="flex items-center gap-1 px-2 py-1.5"
                  style={{ background: t.swatches[2] }}
                >
                  <span className="text-xs">📖</span>
                  <span className="text-[11px] font-bold" style={{ color: t.swatches[0] }}>
                    Mê Truyện
                  </span>
                </div>
                <div className="flex gap-1 p-2">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-14 flex-1 rounded"
                      style={{
                        background: `linear-gradient(135deg, ${t.swatches[0]}55, ${t.swatches[1]}88)`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {t.swatches.map((c, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{ background: c }}
                  />
                ))}
                {active && (
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: 'var(--brand)' }}
                  >
                    Đang dùng
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-bold text-stone-900 dark:text-stone-100">{t.name}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">{t.desc}</p>
              <button
                onClick={() => void apply(t.id)}
                disabled={busy || active}
                className={`${btnPrimary} mt-2 w-full`}
              >
                {busy ? 'Đang áp dụng...' : active ? '✓ Đang dùng' : 'Áp dụng'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Đồng bộ truyện từ API về database ---------------- */
function SyncTab() {
  const [sources, setSources] = useState<ApiSourceRow[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [novels, setNovels] = useState<SyncedNovelRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyNovel, setBusyNovel] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const stopRef = useRef(false);

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
          (r.stopped ? ' · đã dừng' : ''),
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
        <button onClick={() => void doCheck()} disabled={busy || !src} className={btnGhost}>
          {busy ? 'Đang chạy...' : '🔍 Kiểm tra cập nhật'}
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
          phút, cứ để tab mở.
        </p>
        <div className="mt-3 space-y-2">
          {novels.map((n) => {
            const total = n.translated_count || 0;
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
                    <button
                      onClick={() => void doSyncChapters(n)}
                      disabled={busyNovel !== null}
                      className={btnPrimary}
                    >
                      ⬇ Đồng bộ chương
                    </button>
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
    </div>
  );
}

/* ---------------- Admin chính ---------------- */
export default function Admin() {
  const { isAdmin, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  if (!isAdmin) {
    return (
      <p className="py-16 text-center text-lg text-stone-500 dark:text-stone-400">
        ⛔ Khu vực chỉ dành cho quản trị viên.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-amber-950 dark:text-amber-100">
        ⚙️ Quản Trị {profile && <span className="text-base font-normal">· {profile.username}</span>}
      </h1>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-amber-900/15 pb-1 dark:border-amber-100/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold ${
              tab === t.id
                ? 'bg-amber-700 text-white dark:bg-amber-600'
                : 'text-stone-500 hover:bg-amber-100/60 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'sources' && <SourcesTab />}
        {tab === 'sync' && <SyncTab />}
        {tab === 'thumbnails' && <ThumbnailsTab />}
        {tab === 'items' && <ItemsTab />}
        {tab === 'defaults' && <DefaultsTab />}
        {tab === 'theme' && <ThemeTab />}
        {tab === 'system' && <SystemTab />}
      </div>
    </div>
  );
}

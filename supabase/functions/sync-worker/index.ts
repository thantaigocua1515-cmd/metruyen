/**
 * sync-worker — Edge Function đồng bộ truyện từ API về database, CHẠY NỀN.
 *
 * - Nhận POST { job_id } (tiếp tục job có sẵn) hoặc
 *   { kind: 'sync-novel'|'sync-all'|'check-updates', source_id, novel_key? } (tạo job mới).
 * - TRẢ LỜI NGAY { ok:true, job_id }, xử lý nền bằng EdgeRuntime.waitUntil
 *   → user tắt tab vẫn chạy.
 * - Mỗi lượt xử lý tối đa ~8 phút; hết giờ thì TỰ GỌI LẠI chính mình để làm
 *   tiếp chunk sau (fire-and-forget). Tiến trình lưu ở bảng sync_jobs.
 *
 * Deploy (không cần CLI): Supabase Dashboard → Edge Functions → Create a new
 * function → tên `sync-worker` → paste toàn bộ file này → Deploy.
 * Cần chạy migration tạo bảng sync_jobs trước (xem README mục "Đồng bộ nền").
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Ngân sách thời gian mỗi lượt invocation (~8 phút), chừa biên cho self-chain.
const TIME_BUDGET_MS = 8 * 60 * 1000;
// Cập nhật tiến trình + kiểm tra hủy mỗi N chương.
const PROGRESS_EVERY = 10;
// Nghỉ giữa các request cho lịch sự với API nguồn.
const POLITENESS_MS = 150;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const stripSlash = (s: string) => s.replace(/\/+$/, '');
function toNumber(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return fb;
}

type SupaAdmin = ReturnType<typeof createClient>;

interface ApiSource {
  id: string;
  name: string;
  openapi_url: string;
  base_url: string | null;
}

interface SyncJob {
  id: string;
  kind: string;
  source_id: string | null;
  novel_key: string | null;
  status: string;
  total: number;
  done: number;
  skipped: number;
}

/* ---------------- API nguồn (port tối giản từ src/lib/novelApi.ts) ---------------- */

async function resolveBase(source: ApiSource): Promise<string> {
  if (source.base_url) return stripSlash(source.base_url);
  const res = await fetch(source.openapi_url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải openapi.json`);
  const json = (await res.json()) as { servers?: { url?: string }[] };
  const url = json.servers?.[0]?.url;
  if (!url) throw new Error('openapi.json không có servers[0].url');
  return stripSlash(String(url));
}

interface NovelMeta {
  apiId: string;
  title: string;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
  chaptersCount: number;
  translatedCount: number;
  status: string | null;
}

async function apiNovelList(base: string): Promise<NovelMeta[]> {
  const res = await fetch(`${base}/api/v1/novels`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải danh sách truyện`);
  const json = (await res.json()) as { data?: unknown } | unknown[];
  const list = Array.isArray(json) ? json : ((json as { data?: unknown }).data as unknown);
  if (!Array.isArray(list)) return [];
  return (list as Record<string, unknown>[])
    .filter((n) => n && n.id)
    .map((n) => ({
      apiId: String(n.id),
      title: String(n.title ?? 'Không tên'),
      author: (n.author as string | null) ?? null,
      description: (n.description as string | null) ?? null,
      coverUrl: (n.coverUrl as string | null) ?? (n.cover as string | null) ?? null,
      chaptersCount: toNumber(n.chaptersCount),
      translatedCount: toNumber(n.translatedChaptersCount, toNumber(n.chaptersCount)),
      status: typeof n.status === 'string' ? n.status : null,
    }));
}

async function apiNovelDetail(base: string, apiId: string): Promise<NovelMeta> {
  const res = await fetch(`${base}/api/v1/novels/${encodeURIComponent(apiId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải chi tiết truyện`);
  const json = (await res.json()) as { data?: unknown };
  const d = ((json as { data?: unknown }).data ?? json) as Record<string, unknown>;
  return {
    apiId,
    title: String(d.title ?? 'Không tên'),
    author: (d.author as string | null) ?? null,
    description: (d.description as string | null) ?? null,
    coverUrl: (d.coverUrl as string | null) ?? (d.cover as string | null) ?? null,
    chaptersCount: toNumber(d.chaptersCount),
    translatedCount: toNumber(d.translatedChaptersCount, toNumber(d.chaptersCount)),
    status: typeof d.status === 'string' ? d.status : null,
  };
}

/** Lấy tiêu đề + nội dung 1 chương (port từ src/lib/sync.ts#fetchChapterFull). */
async function apiChapterFull(
  base: string,
  apiId: string,
  chapterNum: number,
): Promise<{ title: string; content: string }> {
  const res = await fetch(
    `${base}/api/v1/novels/${encodeURIComponent(apiId)}/chapters/${chapterNum}?format=translated`,
    { headers: { Accept: 'application/json, text/plain' } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải chương ${chapterNum}`);
  const text = await res.text();
  let title = `Chương ${chapterNum}`;
  let content = text;
  if (text.trim()) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === 'string') {
        content = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const d = ((parsed as { data?: unknown }).data ?? parsed) as Record<string, unknown>;
        if (typeof d.title === 'string' && d.title.trim()) title = d.title.trim();
        for (const k of ['content', 'text', 'body', 'contentHtml', 'html']) {
          if (typeof d[k] === 'string' && (d[k] as string).trim()) {
            content = d[k] as string;
            break;
          }
        }
      }
    } catch {
      /* text thuần — giữ nguyên */
    }
  }
  return { title, content };
}

/* ---------------- Job helpers ---------------- */

async function getJob(sb: SupaAdmin, jobId: string): Promise<SyncJob | null> {
  const { data, error } = await sb.from('sync_jobs').select('*').eq('id', jobId).single();
  if (error || !data) return null;
  return data as SyncJob;
}

async function updateJob(sb: SupaAdmin, jobId: string, patch: Record<string, unknown>): Promise<void> {
  await sb
    .from('sync_jobs')
    .update({ ...patch, updated_at: nowIso() })
    .eq('id', jobId);
}

async function refreshNovelCounts(sb: SupaAdmin, key: string): Promise<void> {
  const { count } = await sb
    .from('synced_chapters')
    .select('chapter_number', { count: 'exact', head: true })
    .eq('novel_id', key);
  await sb
    .from('synced_novels')
    .update({ synced_chapters: count ?? 0, last_synced_at: nowIso() })
    .eq('id', key);
}

async function getHaveChapters(sb: SupaAdmin, key: string): Promise<Set<number>> {
  const { data } = await sb.from('synced_chapters').select('chapter_number').eq('novel_id', key);
  return new Set(((data ?? []) as { chapter_number: number }[]).map((r) => r.chapter_number));
}

/* ---------------- Core: sync chương theo khoảng ---------------- */

interface ChunkState {
  t0: number;
  prog: { done: number; total: number; skipped: number };
  job: SyncJob;
}

/** Trả về 'ok' | 'chained' (hết giờ, đã tự gọi tiếp) | 'cancelled' */
async function syncChapterRange(
  sb: SupaAdmin,
  base: string,
  key: string,
  apiId: string,
  from: number,
  to: number,
  st: ChunkState,
): Promise<'ok' | 'chained' | 'cancelled'> {
  const have = await getHaveChapters(sb, key);
  const targets: number[] = [];
  for (let n = from; n <= to; n++) if (!have.has(n)) targets.push(n);

  for (let i = 0; i < targets.length; i++) {
    const n = targets[i];
    // Hết ngân sách thời gian → lưu tiến trình, tự gọi tiếp chunk sau
    if (Date.now() - st.t0 > TIME_BUDGET_MS) {
      await updateJob(sb, st.job.id, {
        done: st.prog.done,
        total: st.prog.total,
        skipped: st.prog.skipped,
        heartbeat_at: nowIso(),
      });
      await doSelfChain(st.job.id);
      return 'chained';
    }
    try {
      const { title, content } = await apiChapterFull(base, apiId, n);
      const { error } = await sb.from('synced_chapters').upsert(
        { novel_id: key, chapter_number: n, title, content, synced_at: nowIso() },
        { onConflict: 'novel_id,chapter_number' },
      );
      if (error) throw error;
    } catch {
      st.prog.skipped++;
    }
    st.prog.done++;
    // Cập nhật tiến trình + kiểm tra hủy mỗi PROGRESS_EVERY chương
    if (st.prog.done % PROGRESS_EVERY === 0 || i === targets.length - 1) {
      await updateJob(sb, st.job.id, {
        done: st.prog.done,
        total: st.prog.total,
        skipped: st.prog.skipped,
        heartbeat_at: nowIso(),
      });
      const cur = await getJob(sb, st.job.id);
      if (cur?.status === 'cancelled') return 'cancelled';
    }
    await sleep(POLITENESS_MS);
  }
  return 'ok';
}

/* ---------------- Các loại job ---------------- */

async function upsertNovelMeta(
  sb: SupaAdmin,
  sourceId: string,
  meta: NovelMeta,
): Promise<{ key: string; isNew: boolean }> {
  const key = `${sourceId}:${meta.apiId}`;
  const { data: existing } = await sb.from('synced_novels').select('id').eq('id', key).single();
  const { error } = await sb.from('synced_novels').upsert(
    {
      id: key,
      source_id: sourceId,
      api_id: meta.apiId,
      title: meta.title,
      author: meta.author,
      description: meta.description,
      cover_url: meta.coverUrl,
      status: meta.status,
      chapters_count: meta.chaptersCount,
      translated_count: meta.translatedCount,
      last_synced_at: nowIso(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
  return { key, isNew: !existing };
}

/** kind = 'sync-novel': đồng bộ chương cho 1 truyện. */
async function runSyncNovel(
  sb: SupaAdmin,
  job: SyncJob,
  source: ApiSource,
  base: string,
  st: ChunkState,
): Promise<'ok' | 'chained' | 'cancelled'> {
  const key = job.novel_key;
  if (!key) throw new Error('Job thiếu novel_key.');
  const { data: row } = await sb
    .from('synced_novels')
    .select('api_id,translated_count')
    .eq('id', key)
    .single();
  if (!row) throw new Error('Truyện chưa có trong database — hãy đồng bộ danh sách trước.');
  const apiId = (row as { api_id: string }).api_id;
  let translated = (row as { translated_count: number }).translated_count ?? 0;
  try {
    const d = await apiNovelDetail(base, apiId);
    translated = d.translatedCount || translated;
    await sb
      .from('synced_novels')
      .update({
        translated_count: translated,
        chapters_count: d.chaptersCount,
        title: d.title,
        last_synced_at: nowIso(),
      })
      .eq('id', key);
  } catch {
    /* dùng số cũ trong DB */
  }
  st.prog.total = translated;
  const r = await syncChapterRange(sb, base, key, apiId, 1, translated, st);
  if (r === 'ok') await refreshNovelCounts(sb, key);
  return r;
}

/** kind = 'sync-all': metadata tất cả truyện rồi sync chương từng truyện. */
async function runSyncAll(
  sb: SupaAdmin,
  job: SyncJob,
  source: ApiSource,
  base: string,
  st: ChunkState,
): Promise<'ok' | 'chained' | 'cancelled'> {
  // Pha 1: metadata
  const list = await apiNovelList(base);
  for (const meta of list) {
    if (Date.now() - st.t0 > TIME_BUDGET_MS) {
      await doSelfChain(job.id);
      return 'chained';
    }
    try {
      await upsertNovelMeta(sb, source.id, meta);
    } catch {
      st.prog.skipped++;
    }
    await sleep(POLITENESS_MS);
  }
  await updateJob(sb, job.id, { heartbeat_at: nowIso() });

  // Pha 2: chương từng truyện — tính total = tổng translated_count
  const { data: novels } = await sb
    .from('synced_novels')
    .select('id,api_id,translated_count')
    .eq('source_id', source.id)
    .order('created_at');
  const rows = (novels ?? []) as { id: string; api_id: string; translated_count: number }[];
  st.prog.total = rows.reduce((s, r) => s + (r.translated_count ?? 0), 0);

  for (const r of rows) {
    let translated = r.translated_count ?? 0;
    try {
      const d = await apiNovelDetail(base, r.api_id);
      translated = d.translatedCount || translated;
      await sb
        .from('synced_novels')
        .update({
          translated_count: translated,
          chapters_count: d.chaptersCount,
          title: d.title,
          last_synced_at: nowIso(),
        })
        .eq('id', r.id);
    } catch {
      /* dùng số cũ */
    }
    // Điều chỉnh total nếu số chương mới khác ước tính ban đầu
    const delta = translated - (r.translated_count ?? 0);
    if (delta !== 0) {
      st.prog.total += delta;
      await updateJob(sb, job.id, { total: st.prog.total, heartbeat_at: nowIso() });
    }
    const res = await syncChapterRange(sb, base, r.id, r.api_id, 1, translated, st);
    await refreshNovelCounts(sb, r.id);
    if (res !== 'ok') return res; // 'chained' hoặc 'cancelled'
    const cur = await getJob(sb, job.id);
    if (cur?.status === 'cancelled') return 'cancelled';
  }
  return 'ok';
}

/** kind = 'check-updates': chỉ thêm truyện mới / chương mới. */
async function runCheckUpdates(
  sb: SupaAdmin,
  job: SyncJob,
  source: ApiSource,
  base: string,
  st: ChunkState,
): Promise<'ok' | 'chained' | 'cancelled'> {
  const list = await apiNovelList(base);
  st.prog.total = list.length;
  const { data: rows } = await sb
    .from('synced_novels')
    .select('id,api_id,translated_count')
    .eq('source_id', source.id);
  const byApiId = new Map(
    ((rows ?? []) as { id: string; api_id: string; translated_count: number }[]).map((r) => [
      r.api_id,
      r,
    ]),
  );
  for (const meta of list) {
    if (Date.now() - st.t0 > TIME_BUDGET_MS) {
      await doSelfChain(job.id);
      return 'chained';
    }
    const cur = byApiId.get(meta.apiId);
    try {
      const d = await apiNovelDetail(base, meta.apiId);
      const key = `${source.id}:${meta.apiId}`;
      if (!cur) {
        await upsertNovelMeta(sb, source.id, d);
        // Truyện mới: sync luôn chương để đọc được ngay
        st.prog.total += d.translatedCount;
        const res = await syncChapterRange(sb, base, key, meta.apiId, 1, d.translatedCount, st);
        await refreshNovelCounts(sb, key);
        if (res !== 'ok') return res;
      } else if (d.translatedCount > cur.translated_count) {
        const from = cur.translated_count + 1;
        st.prog.total += d.translatedCount - cur.translated_count;
        const res = await syncChapterRange(sb, base, cur.id, meta.apiId, from, d.translatedCount, st);
        await sb
          .from('synced_novels')
          .update({
            translated_count: d.translatedCount,
            chapters_count: d.chaptersCount,
            last_synced_at: nowIso(),
          })
          .eq('id', cur.id);
        await refreshNovelCounts(sb, cur.id);
        if (res !== 'ok') return res;
      }
    } catch {
      st.prog.skipped++;
    }
    st.prog.done++;
    if (st.prog.done % PROGRESS_EVERY === 0) {
      await updateJob(sb, job.id, {
        done: st.prog.done,
        total: st.prog.total,
        skipped: st.prog.skipped,
        heartbeat_at: nowIso(),
      });
      const c = await getJob(sb, job.id);
      if (c?.status === 'cancelled') return 'cancelled';
    }
    await sleep(POLITENESS_MS);
  }
  return 'ok';
}

async function doSelfChain(jobId: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/sync-worker`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ job_id: jobId }),
    });
  } catch {
    /* fire-and-forget: lỗi mạng ở đây không chặn gì cả */
  }
}

/* ---------------- Entry: processJob ---------------- */

async function processJob(jobId: string): Promise<void> {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  try {
    const job = await getJob(sb, jobId);
    if (!job) return;
    if (job.status === 'done') return;
    if (job.status === 'cancelled') return;
    if (!job.source_id) throw new Error('Job thiếu source_id.');

    const { data: srcRow } = await sb
      .from('api_sources')
      .select('id,name,openapi_url,base_url')
      .eq('id', job.source_id)
      .single();
    if (!srcRow) throw new Error('Không tìm thấy nguồn API.');
    const source = srcRow as ApiSource;
    const base = await resolveBase(source);

    await updateJob(sb, job.id, { status: 'running', heartbeat_at: nowIso() });
    const st: ChunkState = {
      t0,
      prog: { done: job.done ?? 0, total: job.total ?? 0, skipped: job.skipped ?? 0 },
      job,
    };

    let res: 'ok' | 'chained' | 'cancelled';
    if (job.kind === 'sync-novel') res = await runSyncNovel(sb, job, source, base, st);
    else if (job.kind === 'sync-all') res = await runSyncAll(sb, job, source, base, st);
    else if (job.kind === 'check-updates') res = await runCheckUpdates(sb, job, source, base, st);
    else throw new Error(`kind không hỗ trợ: ${job.kind}`);

    if (res === 'ok') {
      await updateJob(sb, job.id, {
        status: 'done',
        done: st.prog.total,
        total: st.prog.total,
        skipped: st.prog.skipped,
        heartbeat_at: nowIso(),
      });
    } else if (res === 'cancelled') {
      await updateJob(sb, job.id, { status: 'cancelled', heartbeat_at: nowIso() });
    }
    // 'chained': invocation tiếp theo lo phần còn lại; giữ status 'running'.
  } catch (e) {
    try {
      await updateJob(sb, jobId, {
        status: 'error',
        error: e instanceof Error ? e.message : 'Lỗi không xác định.',
        heartbeat_at: nowIso(),
      });
    } catch {
      /* hết cách */
    }
  }
}

/* ---------------- HTTP handler ---------------- */

async function isAdminRequest(req: Request, sb: SupaAdmin): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  if (token === SERVICE_KEY) return true; // self-chain nội bộ
  try {
    const { data, error } = await sb.auth.getUser(token);
    const uid = data?.user?.id;
    if (error || !uid) return false;
    const { data: prof } = await sb.from('profiles').select('role').eq('id', uid).single();
    return (prof as { role?: string } | null)?.role === 'admin';
  } catch {
    return false;
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request): Promise<Response> => {
  const json = (obj: unknown, status = 200): Response =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  // CORS preflight từ trình duyệt — trả 200 để browser cho qua request POST thật
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'Chỉ hỗ trợ POST.' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: 'Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.' }, 500);
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  if (!(await isAdminRequest(req, sb))) {
    return json({ ok: false, error: 'Không có quyền (cần admin).' }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Body phải là JSON.' }, 400);
  }

  let jobId = typeof body.job_id === 'string' ? body.job_id : '';
  if (!jobId) {
    // Tạo job mới
    const kind = String(body.kind ?? '');
    const source_id = typeof body.source_id === 'string' ? body.source_id : null;
    const novel_key = typeof body.novel_key === 'string' ? body.novel_key : null;
    if (!['sync-novel', 'sync-all', 'check-updates'].includes(kind) || !source_id) {
      return json({ ok: false, error: 'Thiếu kind/source_id hợp lệ.' }, 400);
    }
    if (kind === 'sync-novel' && !novel_key) {
      return json({ ok: false, error: 'sync-novel cần novel_key.' }, 400);
    }
    const { data, error } = await sb
      .from('sync_jobs')
      .insert({ kind, source_id, novel_key, status: 'pending' })
      .select('id')
      .single();
    if (error || !data) {
      return json({ ok: false, error: `Tạo job thất bại: ${error?.message ?? '?'}` }, 500);
    }
    jobId = (data as { id: string }).id;
  } else {
    const job = await getJob(sb, jobId);
    if (!job) return json({ ok: false, error: 'Không tìm thấy job.' }, 404);
    if (job.status === 'done') return json({ ok: true, job_id: jobId, note: 'Job đã xong.' });
    // Cho phép chạy tiếp job error/cancelled/running (stalled): reset về running
    if (job.status !== 'running' && job.status !== 'pending') {
      await updateJob(sb, jobId, { status: 'pending', error: null });
    }
  }

  // TRẢ LỜI NGAY, xử lý nền — user tắt tab vẫn chạy
  EdgeRuntime.waitUntil(processJob(jobId));
  return json({ ok: true, job_id: jobId });
});

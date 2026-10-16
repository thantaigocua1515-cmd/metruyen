import { getSupabase } from './supabase';
import { fetchNovels, fetchNovelDetail, resolveBaseUrl } from './novelApi';
import type { ApiSourceRow } from './novelApi';
import { novelKey } from './library';

/**
 * Module đồng bộ truyện từ API về Supabase database.
 *
 * Luồng dùng:
 *   1. Lần đầu: Admin → 🔄 Đồng bộ → "Đồng bộ danh sách truyện" (metadata),
 *      rồi "Đồng bộ chương" từng truyện (nội dung từng chương).
 *   2. Sau này: "Kiểm tra cập nhật" → tự phát hiện truyện mới / chương mới.
 *
 * Tính chất:
 *   - Resume: chương đã có trong DB thì bỏ qua, chạy tiếp phần còn thiếu.
 *   - Bỏ qua chương lỗi (404/timeout...): ghi nhận vào `skipped` và tiếp tục,
 *     không dừng cả quá trình.
 *   - Lịch sự với API: chạy tuần tự từng chương, nghỉ ~150ms giữa các request.
 */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Lấy tiêu đề + nội dung 1 chương từ API (để lưu vào DB). */
async function fetchChapterFull(
  source: ApiSourceRow,
  novelId: string,
  chapterNum: number,
): Promise<{ title: string; content: string }> {
  const base = await resolveBaseUrl(source);
  const res = await fetch(
    `${base}/api/v1/novels/${encodeURIComponent(novelId)}/chapters/${chapterNum}?format=translated`,
    { headers: { Accept: 'application/json, text/plain' } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải chương ${chapterNum}`);
  const text = await res.text();
  let title = `Chương ${chapterNum}`;
  let content = text;
  if (text.trim()) {
    try {
      const json = JSON.parse(text) as unknown;
      if (typeof json === 'string') {
        content = json;
      } else if (json && typeof json === 'object') {
        const d = ((json as { data?: unknown }).data ?? json) as Record<string, unknown>;
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

export async function getSyncedChapterNumbers(novelIdKey: string): Promise<number[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('synced_chapters')
    .select('chapter_number')
    .eq('novel_id', novelIdKey);
  if (error) throw error;
  return ((data ?? []) as { chapter_number: number }[])
    .map((r) => r.chapter_number)
    .sort((a, b) => a - b);
}

async function refreshNovelCounts(key: string): Promise<void> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from('synced_chapters')
    .select('chapter_number', { count: 'exact', head: true })
    .eq('novel_id', key);
  await supabase
    .from('synced_novels')
    .update({ synced_chapters: count ?? 0, last_synced_at: new Date().toISOString() })
    .eq('id', key);
}

export interface ChapterRangeResult {
  synced: number;
  skipped: number[];
  stopped: boolean;
  /** Ghi chú khi dừng sớm (vd: 50 lỗi liên tiếp). */
  note?: string;
}

// Van an toàn: dừng sau N lỗi LIÊN TIẾP (coi như đã hết chương / API lỗi hẳn).
const MAX_CONSECUTIVE_ERRORS = 50;

/** Đồng bộ nội dung các chương [from..to], bỏ qua chương đã có. Dùng chung cho sync đầy đủ và cập nhật. */
async function syncChapterRange(
  source: ApiSourceRow,
  key: string,
  apiId: string,
  from: number,
  to: number,
  onProgress?: (done: number, total: number, current: number) => void,
  shouldStop?: () => boolean,
): Promise<ChapterRangeResult> {
  const supabase = getSupabase();
  const have = new Set(await getSyncedChapterNumbers(key));
  const targets: number[] = [];
  for (let n = from; n <= to; n++) {
    if (!have.has(n)) targets.push(n);
  }
  let synced = 0;
  const skipped: number[] = [];
  let done = 0;
  let consecutiveErrors = 0;
  for (const n of targets) {
    if (shouldStop?.()) return { synced, skipped, stopped: true };
    try {
      const { title, content } = await fetchChapterFull(source, apiId, n);
      const { error } = await supabase.from('synced_chapters').upsert(
        {
          novel_id: key,
          chapter_number: n,
          title,
          content,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'novel_id,chapter_number' },
      );
      if (error) throw error;
      synced++;
      consecutiveErrors = 0;
    } catch {
      skipped.push(n); // chương lỗi → bỏ qua, tiếp tục
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        return {
          synced,
          skipped,
          stopped: true,
          note: `Dừng sau ${MAX_CONSECUTIVE_ERRORS} lỗi liên tiếp (tới chương ${n}) — có thể đã hết chương đọc được hoặc API lỗi.`,
        };
      }
    }
    done++;
    onProgress?.(done, targets.length, n);
    await sleep(150);
  }
  return { synced, skipped, stopped: false };
}

/* ---------------- 1. Đồng bộ danh sách (metadata) ---------------- */

export interface NovelListSyncResult {
  total: number;
  added: number;
  updated: number;
  failed: string[];
}

export async function syncNovelList(source: ApiSourceRow): Promise<NovelListSyncResult> {
  const supabase = getSupabase();
  const list = await fetchNovels(source);
  const { data: existing } = await supabase
    .from('synced_novels')
    .select('id')
    .eq('source_id', source.id);
  const existingIds = new Set(((existing ?? []) as { id: string }[]).map((r) => r.id));
  let added = 0;
  let updated = 0;
  const failed: string[] = [];
  for (const n of list) {
    try {
      const d = await fetchNovelDetail(source, n.id);
      const key = novelKey(source.id, n.id);
      const isNew = !existingIds.has(key);
      const { error } = await supabase.from('synced_novels').upsert(
        {
          id: key,
          source_id: source.id,
          api_id: n.id,
          title: d.title,
          author: d.author,
          description: d.description,
          cover_url: d.coverUrl,
          status: d.status,
          chapters_count: d.chaptersCount,
          translated_count: d.translatedChaptersCount,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (error) throw error;
      if (isNew) added++;
      else updated++;
    } catch (e) {
      failed.push(`${n.title}: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
    await sleep(150);
  }
  return { total: list.length, added, updated, failed };
}

/* ---------------- 2. Đồng bộ chương của 1 truyện ---------------- */

export interface ChaptersSyncResult extends ChapterRangeResult {
  total: number;
}

export async function syncChapters(
  source: ApiSourceRow,
  key: string,
  onProgress?: (done: number, total: number, current: number) => void,
  shouldStop?: () => boolean,
): Promise<ChaptersSyncResult> {
  const supabase = getSupabase();
  const { data: row, error: rowErr } = await supabase
    .from('synced_novels')
    .select('api_id,translated_count,chapters_count')
    .eq('id', key)
    .single();
  if (rowErr || !row) {
    throw new Error('Truyện chưa có trong database — hãy "Đồng bộ danh sách truyện" trước.');
  }
  const apiId = (row as { api_id: string }).api_id;
  // Một số truyện API báo translated_count=0 nhưng endpoint chương vẫn trả nội dung
  // → lấy max để không bao giờ sync 0 chương.
  const rowCounts = row as { translated_count: number; chapters_count: number };
  let translated = Math.max(rowCounts.translated_count ?? 0, rowCounts.chapters_count ?? 0);
  // Lấy số chương mới nhất từ API trước khi sync
  try {
    const d = await fetchNovelDetail(source, apiId);
    translated = Math.max(d.translatedChaptersCount, d.chaptersCount, translated);
    await supabase
      .from('synced_novels')
      .update({
        translated_count: d.translatedChaptersCount,
        chapters_count: d.chaptersCount,
        title: d.title,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', key);
  } catch {
    /* không lấy được detail mới thì dùng số cũ trong DB */
  }
  const r = await syncChapterRange(source, key, apiId, 1, translated, onProgress, shouldStop);
  await refreshNovelCounts(key);
  return { ...r, total: translated };
}

/* ---------------- 3. Kiểm tra cập nhật ---------------- */

export interface NovelUpdate {
  title: string;
  newChapters: number;
}

export interface CheckUpdatesResult {
  newNovels: string[];
  updated: NovelUpdate[];
  failed: string[];
}

export async function checkUpdates(source: ApiSourceRow): Promise<CheckUpdatesResult> {
  // Truyện nhập tay không có API để kiểm tra → bỏ qua
  if (source.id === 'manual') return { newNovels: [], updated: [], failed: [] };
  const supabase = getSupabase();
  const list = await fetchNovels(source);
  const { data: rows } = await supabase
    .from('synced_novels')
    .select('id,api_id,title,translated_count,chapters_count')
    .eq('source_id', source.id);
  const byApiId = new Map(
    (
      (rows ?? []) as {
        id: string;
        api_id: string;
        title: string;
        translated_count: number;
        chapters_count: number;
      }[]
    ).map((r) => [r.api_id, r]),
  );
  const newNovels: string[] = [];
  const updated: NovelUpdate[] = [];
  const failed: string[] = [];

  for (const n of list) {
    const cur = byApiId.get(n.id);
    try {
      const d = await fetchNovelDetail(source, n.id);
      const key = novelKey(source.id, n.id);
      // Dùng max(translated, chapters) — API có truyện báo translated=0 nhưng vẫn có nội dung.
      const apiTotal = Math.max(d.translatedChaptersCount, d.chaptersCount);
      const curTotal = cur ? Math.max(cur.translated_count ?? 0, cur.chapters_count ?? 0) : 0;
      if (!cur) {
        // Truyện mới → lưu metadata trước, chương đồng bộ sau
        const { error } = await supabase.from('synced_novels').upsert(
          {
            id: key,
            source_id: source.id,
            api_id: n.id,
            title: d.title,
            author: d.author,
            description: d.description,
            cover_url: d.coverUrl,
            status: d.status,
            chapters_count: d.chaptersCount,
            translated_count: d.translatedChaptersCount,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );
        if (error) throw error;
        newNovels.push(d.title);
      } else if (apiTotal > curTotal) {
        // Có chương mới → chỉ sync các chương mới
        const r = await syncChapterRange(source, cur.id, n.id, curTotal + 1, apiTotal);
        await supabase
          .from('synced_novels')
          .update({
            translated_count: d.translatedChaptersCount,
            chapters_count: d.chaptersCount,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', cur.id);
        await refreshNovelCounts(cur.id);
        updated.push({ title: d.title, newChapters: r.synced });
      }
    } catch (e) {
      failed.push(`${n.title}: ${e instanceof Error ? e.message : 'lỗi'}`);
    }
    await sleep(150);
  }
  return { newNovels, updated, failed };
}

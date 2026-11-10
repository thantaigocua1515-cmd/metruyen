import { getSupabase } from './supabase';
import type { ChapterMeta, NovelSummary } from './novelApi';

/**
 * Đọc truyện đã đồng bộ từ Supabase (ưu tiên DB, fallback API ở tầng gọi).
 * Khóa truyện trong DB: `${sourceId}:${apiNovelId}`.
 */

export const novelKey = (sourceId: string, apiId: string): string => `${sourceId}:${apiId}`;

export interface SyncedNovelRow {
  id: string;
  source_id: string;
  api_id: string;
  title: string;
  author: string | null;
  description: string | null;
  cover_url: string | null;
  status: string | null;
  chapters_count: number;
  translated_count: number;
  synced_chapters: number;
  last_synced_at: string | null;
}

export interface SyncedChapter {
  title: string;
  content: string;
}

/** Map 1 dòng synced_novels → NovelSummary để tái dùng NovelCard/Home. */
export function syncedRowToSummary(row: SyncedNovelRow, sourceName: string): NovelSummary {
  return {
    sourceId: row.source_id,
    sourceName,
    id: row.api_id,
    title: row.title,
    author: row.author,
    description: row.description,
    coverUrl: row.cover_url,
    chaptersCount: row.chapters_count,
    translatedChaptersCount: row.translated_count,
    status: row.status,
    links: {},
  };
}

/** Danh sách truyện đã sync của 1 nguồn (sắp xếp theo tên). */
export async function getSyncedNovels(sourceId: string): Promise<SyncedNovelRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('synced_novels')
    .select('*')
    .eq('source_id', sourceId)
    .order('title');
  if (error) throw error;
  return (data ?? []) as SyncedNovelRow[];
}

export async function getSyncedNovel(key: string): Promise<SyncedNovelRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('synced_novels').select('*').eq('id', key).maybeSingle();
  if (error) throw error;
  return (data as SyncedNovelRow | null) ?? null;
}

/** Nội dung 1 chương từ DB; null nếu chưa đồng bộ. */
export async function getSyncedChapter(key: string, num: number): Promise<SyncedChapter | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('synced_chapters')
    .select('title,content')
    .eq('novel_id', key)
    .eq('chapter_number', num)
    .maybeSingle();
  if (error) throw error;
  return (data as SyncedChapter | null) ?? null;
}

/**
 * Danh sách chương THẬT đã đồng bộ (số + tiêu đề thật), sắp xếp tăng dần.
 * Dùng cho mục lục NovelDetail và cuộn vô hạn — chính xác hơn danh sách ảo.
 *
 * Lưu ý: Supabase PostgREST giới hạn mặc định tối đa 1000 dòng mỗi request
 * (`max_rows = 1000`), nên phải phân trang bằng `.range()` để lấy đủ các bộ
 * truyện dài hàng nghìn chương.
 */
export async function getSyncedNovelChapterList(key: string): Promise<ChapterMeta[]> {
  const supabase = getSupabase();
  const PAGE_SIZE = 1000;
  const rows: { chapter_number: number; title: string }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('synced_chapters')
      .select('chapter_number,title')
      .eq('novel_id', key)
      .order('chapter_number', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as { chapter_number: number; title: string }[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows.map((r) => ({
    number: r.chapter_number,
    title: r.title?.trim() ? r.title : `Chương ${r.chapter_number}`,
  }));
}

/**
 * Gộp danh sách chương từ API và danh sách chương đã đồng bộ trong DB,
 * đồng thời bù đủ các chương tới `totalExpected` để không bị cắt ở mốc 1000 chương
 * hoặc khi truyện mới chỉ đồng bộ một phần trong DB.
 */
export function mergeChapterLists(
  apiChapters: ChapterMeta[],
  syncedChapters: ChapterMeta[],
  totalExpected = 0,
): ChapterMeta[] {
  const map = new Map<number, string>();
  for (const c of apiChapters) {
    if (c.number > 0) map.set(c.number, c.title);
  }
  for (const c of syncedChapters) {
    if (c.number > 0) map.set(c.number, c.title);
  }
  const maxExisting = map.size > 0 ? Math.max(...map.keys()) : 0;
  const maxTotal = Math.max(totalExpected, maxExisting);
  for (let n = 1; n <= maxTotal; n++) {
    if (!map.has(n)) {
      map.set(n, `Chương ${n}`);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([number, title]) => ({ number, title }));
}

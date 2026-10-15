import { useEffect, useState } from 'react';
import { getSupabase } from './supabase';
import { fetchNovels } from './novelApi';
import type { ApiSourceRow, NovelSummary } from './novelApi';
import { syncedRowToSummary } from './library';
import type { SyncedNovelRow } from './library';

/**
 * Hook dùng chung: tải truyện từ mọi nguồn API đang bật + thumbnail overrides.
 * Ưu tiên database đã đồng bộ (synced_novels); nguồn nào chưa sync thì
 * đọc live từ API như cũ. Dùng ở Home, Search, Genres để không lặp logic fetch.
 */
export function useNovels() {
  const [novels, setNovels] = useState<NovelSummary[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [syncedSourceIds, setSyncedSourceIds] = useState<string[]>([]);
  const [liveSourceIds, setLiveSourceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabase();
        const { data: sources, error: sErr } = await supabase
          .from('api_sources')
          .select('id,name,openapi_url,base_url,is_active')
          .eq('is_active', true);
        if (sErr) throw sErr;
        const list = (sources ?? []) as ApiSourceRow[];

        // Truyện đã đồng bộ trong DB (bảng có thể chưa tồn tại nếu user chưa chạy migration → bỏ qua)
        const bySource = new Map<string, SyncedNovelRow[]>();
        try {
          const { data: synced } = await supabase.from('synced_novels').select('*');
          for (const r of (synced ?? []) as SyncedNovelRow[]) {
            const arr = bySource.get(r.source_id) ?? [];
            arr.push(r);
            bySource.set(r.source_id, arr);
          }
        } catch {
          /* chưa có bảng synced_novels → đọc live toàn bộ */
        }

        const all: NovelSummary[] = [];
        const syncedIds: string[] = [];
        const liveIds: string[] = [];
        for (const s of list) {
          const rows = bySource.get(s.id) ?? [];
          if (rows.length > 0) {
            // Ưu tiên DB
            all.push(...rows.map((r) => syncedRowToSummary(r, s.name)));
            syncedIds.push(s.id);
          } else {
            // Fallback: đọc live từ API
            try {
              const ns = await fetchNovels(s);
              all.push(...ns);
              liveIds.push(s.id);
            } catch (e) {
              console.warn(`Nguồn "${s.name}" lỗi:`, e);
            }
          }
        }
        const { data: ov } = await supabase
          .from('thumbnail_overrides')
          .select('source_id,novel_id,thumbnail_url');
        const map: Record<string, string> = {};
        for (const r of (ov ?? []) as {
          source_id: string;
          novel_id: string;
          thumbnail_url: string;
        }[]) {
          map[`${r.source_id}:${r.novel_id}`] = r.thumbnail_url;
        }
        if (alive) {
          setNovels(all);
          setOverrides(map);
          setSyncedSourceIds(syncedIds);
          setLiveSourceIds(liveIds);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Tải danh sách truyện thất bại.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { novels, overrides, loading, error, syncedSourceIds, liveSourceIds };
}

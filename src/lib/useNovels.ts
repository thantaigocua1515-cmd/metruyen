import { useEffect, useState } from 'react';
import { getSupabase } from './supabase';
import { fetchNovels } from './novelApi';
import type { ApiSourceRow, NovelSummary } from './novelApi';

/**
 * Hook dùng chung: tải truyện từ mọi nguồn API đang bật + thumbnail overrides.
 * Dùng ở Home, Search, Genres để không lặp logic fetch.
 */
export function useNovels() {
  const [novels, setNovels] = useState<NovelSummary[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
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
        const all: NovelSummary[] = [];
        for (const s of list) {
          try {
            const ns = await fetchNovels(s);
            all.push(...ns);
          } catch (e) {
            console.warn(`Nguồn "${s.name}" lỗi:`, e);
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

  return { novels, overrides, loading, error };
}

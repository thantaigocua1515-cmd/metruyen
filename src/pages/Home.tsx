import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { fetchNovels } from '../lib/novelApi';
import type { ApiSourceRow, NovelSummary } from '../lib/novelApi';
import NovelCard from '../components/NovelCard';

export default function Home() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
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

  const filtered = useMemo(() => {
    if (!q) return novels;
    return novels.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || (n.author ?? '').toLowerCase().includes(q),
    );
  }, [novels, q]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl font-bold text-amber-950 dark:text-amber-100">
          📚 Thư Các Mê Truyện
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {q ? (
            <>
              Kết quả cho "<b>{searchParams.get('q')}</b>": {filtered.length} truyện
            </>
          ) : (
            <>Tổng {novels.length} truyện · đọc để tăng tu vi, kiếm linh thạch</>
          )}
        </p>
      </div>

      {loading && (
        <p className="py-16 text-center text-stone-500 dark:text-stone-400">
          📖 Đang thỉnh kinh từ các nguồn...
        </p>
      )}

      {error && (
        <div className="mx-auto max-w-xl rounded-xl border border-red-300 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="py-16 text-center italic text-stone-500 dark:text-stone-400">
          Chưa có truyện nào. Admin hãy bật nguồn API trong Quản trị → Nguồn API.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6">
        {filtered.map((n) => (
          <NovelCard
            key={`${n.sourceId}:${n.id}`}
            novel={n}
            coverOverride={overrides[`${n.sourceId}:${n.id}`]}
          />
        ))}
      </div>
    </div>
  );
}

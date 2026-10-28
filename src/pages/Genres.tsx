import { useMemo, useState } from 'react';
import { useTemplate } from '../context/TemplateContext';
import { useNovels } from '../lib/useNovels';
import { GENRES, filterByGenre } from '../lib/genres';
import NovelCard from '../components/NovelCard';

/** Trang thể loại: hàng pill + lưới truyện (lọc bằng heuristic keyword). */
export default function Genres() {
  const { template } = useTemplate();
  const { novels, overrides, loading, error } = useNovels();
  const [genre, setGenre] = useState('all');

  const filtered = useMemo(() => filterByGenre(novels, genre), [novels, genre]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of GENRES) m[g.id] = filterByGenre(novels, g.id).length;
    return m;
  }, [novels]);

  const isTruyenc = template === 'truyenc';
  const gridCls = isTruyenc
    ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6';

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
      <h1
        className="text-center text-2xl font-bold"
        style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
      >
        🗂️ Thể Loại
      </h1>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {GENRES.map((g) => {
          const active = genre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGenre(g.id)}
              className="whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition"
              style={
                active
                  ? { background: 'var(--brand)', color: '#fff' }
                  : {
                      background: 'var(--card-bg)',
                      color: 'var(--muted)',
                      border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)',
                    }
              }
            >
              {g.label}
              {novels.length > 0 && (
                <span className="ml-1 opacity-70">({counts[g.id] ?? 0})</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-center text-xs italic" style={{ color: 'var(--muted)' }}>
        * Thể loại do web tự đoán theo từ khóa (API chưa có trường thể loại).
      </p>

      {loading && (
        <p className="py-16 text-center" style={{ color: 'var(--muted)' }}>
          📖 Đang thỉnh kinh từ các nguồn...
        </p>
      )}
      {error && (
        <p className="py-16 text-center text-red-600 dark:text-red-400">{error}</p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p className="py-16 text-center italic" style={{ color: 'var(--muted)' }}>
          Chưa có truyện nào thuộc thể loại này.
        </p>
      )}

      <div className={`${gridCls} mt-4`}>
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

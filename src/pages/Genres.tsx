import { useMemo, useState } from 'react';
import { useTemplate } from '../context/TemplateContext';
import { useNovels } from '../lib/useNovels';
import { GENRES, filterByGenre } from '../lib/genres';
import NovelCard from '../components/NovelCard';

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

  const isSwiss = template === 'toi-gian';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--brand)' }}>
          Phân Loại Kinh Thư
        </p>
        <h1
          className="font-display mt-1 text-3xl font-bold sm:text-4xl"
          style={{ color: 'var(--ink)' }}
        >
          Thể Loại Tác Phẩm
        </h1>
      </div>

      <div className="no-scrollbar mt-6 flex flex-wrap justify-center gap-2 pb-2">
        {GENRES.map((g) => {
          const active = genre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGenre(g.id)}
              className={`cursor-pointer border px-4 py-2 text-xs font-bold whitespace-nowrap transition sm:text-sm ${
                isSwiss ? 'font-mono-tech uppercase' : 'rounded-full'
              }`}
              style={
                active
                  ? {
                      background: 'var(--brand)',
                      color: '#fff',
                      borderColor: 'var(--brand)',
                    }
                  : {
                      background: 'var(--card-bg)',
                      color: 'var(--ink)',
                      borderColor: 'var(--border)',
                    }
              }
            >
              {g.label}
              {novels.length > 0 && (
                <span className="ml-1.5 opacity-75">({counts[g.id] ?? 0})</span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="py-16 text-center" style={{ color: 'var(--muted)' }}>
          Đang tải danh mục thể loại...
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

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((n, idx) => (
          <NovelCard
            key={`${n.sourceId}:${n.id}`}
            novel={n}
            index={idx}
            coverOverride={overrides[`${n.sourceId}:${n.id}`]}
          />
        ))}
      </div>
    </div>
  );
}

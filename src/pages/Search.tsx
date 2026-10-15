import { useMemo, useState } from 'react';
import { useTemplate } from '../context/TemplateContext';
import { useNovels } from '../lib/useNovels';
import NovelCard from '../components/NovelCard';

/** Trang tìm kiếm: ô tìm lớn + lưới kết quả. */
export default function Search() {
  const { template } = useTemplate();
  const { novels, overrides, loading, error } = useNovels();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!query) return [];
    return novels.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        (n.author ?? '').toLowerCase().includes(query),
    );
  }, [novels, query]);

  const gridCls =
    template === 'truyenc'
      ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'
      : 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6';

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
      <h1
        className="text-center text-2xl font-bold"
        style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
      >
        🔍 Tìm kiếm
      </h1>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="mx-auto mt-4 max-w-xl"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nhập tên truyện hoặc tác giả..."
          autoFocus
          className="w-full rounded-2xl border bg-[var(--card-bg)] px-5 py-3 text-base outline-none focus:border-[var(--brand)]"
          style={{ borderColor: 'color-mix(in srgb, var(--ink) 18%, transparent)', color: 'var(--ink)' }}
        />
      </form>

      {loading && (
        <p className="py-16 text-center" style={{ color: 'var(--muted)' }}>
          📖 Đang tìm trong thư các...
        </p>
      )}
      {error && (
        <p className="py-16 text-center text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && query && (
        <p className="mt-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
          {results.length} kết quả cho "<b>{q.trim()}</b>"
        </p>
      )}
      {!loading && !error && !query && (
        <p className="mt-4 text-center text-sm italic" style={{ color: 'var(--muted)' }}>
          Gõ tên truyện hoặc tác giả để bắt đầu tìm.
        </p>
      )}

      <div className={`${gridCls} mt-4`}>
        {results.map((n) => (
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

import { useMemo, useState } from 'react';
import { useTemplate } from '../context/TemplateContext';
import { useNovels } from '../lib/useNovels';
import NovelCard from '../components/NovelCard';
import { SearchIcon } from '../components/icons';

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

  const isSwiss = template === 'toi-gian';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--brand)' }}>
          Tầm Thư Các
        </p>
        <h1
          className="font-display mt-1 text-3xl font-bold sm:text-4xl"
          style={{ color: 'var(--ink)' }}
        >
          Tìm Kiếm Tác Phẩm
        </h1>
        <form onSubmit={(e) => e.preventDefault()} className="relative mt-5">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nhập tên truyện hoặc đạo hiệu tác giả..."
            autoFocus
            className={`h-13 w-full border bg-[var(--card-bg)] pl-12 pr-5 text-base outline-none transition ${
              isSwiss ? '' : 'rounded-2xl shadow-sm'
            }`}
            style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
          />
        </form>
      </div>

      {loading && (
        <p className="py-16 text-center" style={{ color: 'var(--muted)' }}>
          Đang lục tìm trong thư các...
        </p>
      )}
      {error && (
        <p className="py-16 text-center text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && query && (
        <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Tìm thấy <strong style={{ color: 'var(--brand)' }}>{results.length}</strong> kết quả cho "
          <strong style={{ color: 'var(--ink)' }}>{q.trim()}</strong>"
        </p>
      )}
      {!loading && !error && !query && (
        <p className="mt-6 text-center text-sm italic" style={{ color: 'var(--muted)' }}>
          Gõ từ khóa tên truyện hoặc tác giả để bắt đầu tra cứu.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {results.map((n, idx) => (
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

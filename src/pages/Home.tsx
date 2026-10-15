import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTemplate } from '../context/TemplateContext';
import { useAuth } from '../context/AuthContext';
import { useNovels } from '../lib/useNovels';
import { GENRES, filterByGenre } from '../lib/genres';
import NovelCard from '../components/NovelCard';

function LoadingBlock() {
  return (
    <p className="py-16 text-center" style={{ color: 'var(--muted)' }}>
      📖 Đang thỉnh kinh từ các nguồn...
    </p>
  );
}

function ErrorBlock({ error }: { error: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-red-300 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {error}
    </div>
  );
}

/** Gợi ý admin đồng bộ truyện về database (chỉ hiện khi còn nguồn đọc live). */
function SyncHint({ liveSourceIds }: { liveSourceIds: string[] }) {
  const { isAdmin } = useAuth();
  if (!isAdmin || liveSourceIds.length === 0) return null;
  return (
    <p
      className="mx-auto mb-4 max-w-2xl rounded-xl px-4 py-2 text-center text-xs"
      style={{
        background: 'var(--brand-soft)',
        color: 'var(--muted)',
        border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)',
      }}
    >
      💡 Một số nguồn đang đọc trực tiếp từ API. Vào{' '}
      <Link to="/admin" className="font-semibold underline" style={{ color: 'var(--brand)' }}>
        Quản trị → 🔄 Đồng bộ
      </Link>{' '}
      để lưu truyện về database (đọc nhanh hơn, mục lục chính xác).
    </p>
  );
}

/** Trang chủ kiểu TruyenC: Truyện Hot + pills thể loại + lưới card 2 cột. */
function TruyencHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [genre, setGenre] = useState('all');

  const hot = useMemo(() => {
    const list = filterByGenre(novels, genre);
    return [...list].sort((a, b) => b.chaptersCount - a.chaptersCount);
  }, [novels, genre]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 sm:px-4">
      {/* Tiêu đề mục Hot */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl"
          style={{ background: 'var(--brand-soft)' }}
        >
          🔥
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>
          Truyện Hot
        </h1>
      </div>
      <Link
        to="/genres"
        className="mt-1 inline-block text-sm font-semibold"
        style={{ color: 'var(--brand)' }}
      >
        Xem tất cả <span aria-hidden>›</span>
      </Link>

      {/* Pills thể loại cuộn ngang */}
      <div className="no-scrollbar -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {GENRES.filter((g) => g.id !== 'khac').map((g) => {
          const active = genre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGenre(g.id)}
              className="shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition"
              style={
                active
                  ? { background: 'var(--brand)', color: '#fff', boxShadow: '0 4px 12px color-mix(in srgb, var(--brand) 40%, transparent)' }
                  : {
                      background: 'var(--card-bg)',
                      color: 'var(--muted)',
                      border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)',
                    }
              }
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}

      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      {!loading && !error && hot.length === 0 && (
        <p className="py-16 text-center italic" style={{ color: 'var(--muted)' }}>
          Chưa có truyện nào. Admin hãy bật nguồn API trong Quản trị → Nguồn API.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {hot.map((n) => (
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

/** Trang chủ mặc định (các template còn lại). */
function DefaultHome() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();

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
        <h1
          className="text-3xl font-bold"
          style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
        >
          📚 Thư Các Mê Truyện
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {q ? (
            <>
              Kết quả cho "<b>{searchParams.get('q')}</b>": {filtered.length} truyện
            </>
          ) : (
            <>Tổng {novels.length} truyện · đọc để tăng tu vi, kiếm linh thạch</>
          )}
        </p>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}

      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      {!loading && !error && filtered.length === 0 && (
        <p className="py-16 text-center italic" style={{ color: 'var(--muted)' }}>
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

export default function Home() {
  const { template } = useTemplate();
  if (template === 'truyenc') return <TruyencHome />;
  return <DefaultHome />;
}

import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTemplate } from '../context/TemplateContext';
import { useAuth } from '../context/AuthContext';
import { useNovels } from '../lib/useNovels';
import { GENRES, filterByGenre } from '../lib/genres';
import NovelCard, { TinhHaVerticalCard, TinhHaRowCard } from '../components/NovelCard';
import { ArrowRightIcon, FlameIcon, SearchIcon } from '../components/icons';
import type { NovelSummary } from '../lib/novelApi';

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

/** Tiêu đề mục kiểu editorial cho template tinh-ha. */
function TinhHaSectionHeader({
  overline,
  title,
  moreTo,
}: {
  overline: string;
  title: string;
  moreTo?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p
          className="text-[11px] font-bold uppercase tracking-[0.22em]"
          style={{ color: 'var(--brand)' }}
        >
          {overline}
        </p>
        <h2
          className="mt-1 text-3xl font-semibold sm:text-4xl"
          style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h2>
      </div>
      {moreTo && (
        <Link
          to={moreTo}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--brand)' }}
        >
          Xem tất cả
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/** Trang chủ template tinh-ha: hero điện ảnh + hàng cuộn ngang + lưới card ngang. */
function TinhHaHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sq, setSq] = useState(searchParams.get('q') ?? '');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const featured: NovelSummary | null = useMemo(() => {
    if (novels.length === 0) return null;
    return [...novels].sort(
      (a, b) =>
        (b.translatedChaptersCount || b.chaptersCount) -
        (a.translatedChaptersCount || a.chaptersCount),
    )[0];
  }, [novels]);

  const filtered = useMemo(() => {
    if (!q) return novels;
    return novels.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || (n.author ?? '').toLowerCase().includes(q),
    );
  }, [novels, q]);

  const latest = useMemo(() => filtered.slice(0, 12), [filtered]);
  const featuredCover = featured
    ? overrides[`${featured.sourceId}:${featured.id}`] || featured.coverUrl
    : null;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = sq.trim();
    navigate(query ? `/?q=${encodeURIComponent(query)}` : '/');
  };

  return (
    <div>
      {/* HERO điện ảnh */}
      {featured && !loading && !error && (
        <section className="relative overflow-hidden">
          {featuredCover && (
            <div className="absolute inset-0" aria-hidden="true">
              <img
                src={featuredCover}
                alt=""
                className="h-full w-full object-cover object-top"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, var(--page-bg) 4%, color-mix(in srgb, var(--page-bg) 62%, transparent) 42%, transparent 72%), linear-gradient(to right, color-mix(in srgb, var(--page-bg) 58%, transparent) 0%, transparent 62%)',
                }}
              />
            </div>
          )}
          <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pb-10 pt-24 sm:px-6 sm:pb-14 min-h-[52vh] sm:min-h-[70vh]">
            <div className="max-w-2xl">
              <p
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em]"
                style={{ color: 'var(--brand)' }}
              >
                <FlameIcon className="h-4 w-4" />
                Đề cử
              </p>
              <h1
                className="mt-3 text-4xl font-semibold leading-[1.05] sm:text-6xl"
                style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
              >
                {featured.title}
              </h1>
              {featured.author && (
                <p className="mt-2 text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  {featured.author}
                </p>
              )}
              {featured.description && (
                <p className="clamp-3 mt-3 max-w-xl text-sm leading-relaxed sm:text-base" style={{ color: 'var(--muted)' }}>
                  {featured.description}
                </p>
              )}
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--brand-strong)' }}>
                {featured.translatedChaptersCount || featured.chaptersCount} chương đọc được
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  to={`/read/${featured.sourceId}/${encodeURIComponent(featured.id)}/1`}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 text-base font-bold text-white shadow-lg transition hover:opacity-90 dark:text-stone-950"
                  style={{ background: 'var(--brand)' }}
                >
                  Đọc ngay
                  <ArrowRightIcon className="h-5 w-5" />
                </Link>
                <Link
                  to={`/novel/${featured.sourceId}/${encodeURIComponent(featured.id)}`}
                  className="inline-flex min-h-[48px] items-center rounded-full px-7 text-base font-semibold transition hover:opacity-80"
                  style={{
                    border: '1px solid var(--border, color-mix(in srgb, var(--ink) 20%, transparent))',
                    color: 'var(--ink)',
                    background: 'color-mix(in srgb, var(--card-bg) 72%, transparent)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  Chi tiết
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Ô tìm kiếm */}
        <form onSubmit={submitSearch} className="relative mx-auto mb-10 max-w-2xl">
          <span
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--muted)' }}
            aria-hidden="true"
          >
            <SearchIcon className="h-5 w-5" />
          </span>
          <input
            value={sq}
            onChange={(e) => setSq(e.target.value)}
            placeholder="Tìm truyện, tác giả..."
            aria-label="Tìm truyện"
            className="min-h-[52px] w-full rounded-full bg-[var(--card-bg)] pl-12 pr-5 text-base outline-none transition"
            style={{
              border: '1px solid var(--border, color-mix(in srgb, var(--ink) 18%, transparent))',
              color: 'var(--ink)',
            }}
          />
        </form>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock error={error} />}

        {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

        {!loading && !error && filtered.length === 0 && (
          <p className="py-16 text-center italic" style={{ color: 'var(--muted)' }}>
            {q
              ? `Không tìm thấy truyện nào cho "${searchParams.get('q')}".`
              : 'Chưa có truyện nào. Admin hãy bật nguồn API trong Quản trị → Nguồn API.'}
          </p>
        )}

        {/* Mới cập nhật: hàng cuộn ngang scroll-snap */}
        {!loading && !error && !q && latest.length > 0 && (
          <section className="mb-12" aria-label="Mới cập nhật">
            <TinhHaSectionHeader overline="Thư các" title="Mới cập nhật" moreTo="/genres" />
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {latest.map((n) => (
                <TinhHaVerticalCard
                  key={`${n.sourceId}:${n.id}`}
                  novel={n}
                  coverOverride={overrides[`${n.sourceId}:${n.id}`]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Toàn bộ truyện: lưới card ngang */}
        {!loading && !error && filtered.length > 0 && (
          <section aria-label={q ? 'Kết quả tìm kiếm' : 'Toàn bộ truyện'}>
            <TinhHaSectionHeader
              overline={q ? 'Tìm kiếm' : 'Thư các'}
              title={q ? `Kết quả cho "${searchParams.get('q')}"` : 'Toàn bộ truyện'}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
              {filtered.map((n) => (
                <TinhHaRowCard
                  key={`${n.sourceId}:${n.id}`}
                  novel={n}
                  coverOverride={overrides[`${n.sourceId}:${n.id}`]}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { template } = useTemplate();
  if (template === 'truyenc') return <TruyencHome />;
  if (template === 'tinh-ha') return <TinhHaHome />;
  return <DefaultHome />;
}

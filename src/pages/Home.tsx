import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTemplate } from '../context/TemplateContext';
import { useAuth } from '../context/AuthContext';
import { useNovels } from '../lib/useNovels';
import { GENRES, filterByGenre, genreLabel, guessGenre } from '../lib/genres';
import { getRank, formatHours } from '../lib/tuvi';
import NovelCard, { TinhHaVerticalCard, TinhHaRowCard } from '../components/NovelCard';
import {
  ArrowRightIcon,
  BookOpenIcon,
  FlameIcon,
  GemIcon,
  ScrollIcon,
  SearchIcon,
  SparklesIcon,
  TrophyIcon,
} from '../components/icons';
import type { NovelSummary } from '../lib/novelApi';

const FALLBACK_COVER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2f5e"/><stop offset="1" stop-color="#141021"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><text x="150" y="210" font-size="44" font-family="serif" text-anchor="middle" fill="#d4af37">MÊ TRUYỆN</text></svg>`,
  );

function LoadingBlock() {
  return (
    <div className="py-20 text-center" style={{ color: 'var(--muted)' }}>
      <div
        className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-current border-t-transparent"
        style={{ color: 'var(--brand)' }}
      />
      <p className="text-sm font-medium">Đang thỉnh kinh từ các nguồn dữ liệu...</p>
    </div>
  );
}

function ErrorBlock({ error }: { error: string }) {
  return (
    <div className="mx-auto my-8 max-w-xl rounded-2xl border border-red-300 bg-red-50 p-5 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {error}
    </div>
  );
}

function SyncHint({ liveSourceIds }: { liveSourceIds: string[] }) {
  const { isAdmin } = useAuth();
  if (!isAdmin || liveSourceIds.length === 0) return null;
  return (
    <div
      className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center text-xs"
      style={{
        background: 'var(--brand-soft)',
        color: 'var(--ink)',
        border: '1px solid var(--border)',
      }}
    >
      <span>Một số nguồn đang đọc trực tiếp từ API.</span>
      <Link to="/admin" className="font-bold underline" style={{ color: 'var(--brand-strong)' }}>
        Vào Quản trị → Đồng bộ
      </Link>
      <span>để lưu truyện về máy chủ đọc nhanh hơn.</span>
    </div>
  );
}

/* ============================================================================
   1. TEMPLATE THU-CAC: Scholarly Cultivation Library (Bento Grid & Book Spine)
   ============================================================================ */
function ThuCacHome() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const { user, profile } = useAuth();
  const [genre, setGenre] = useState('all');

  const filtered = useMemo(() => {
    const byGenre = filterByGenre(novels, genre);
    if (!q) return byGenre;
    return byGenre.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || (n.author ?? '').toLowerCase().includes(q),
    );
  }, [novels, genre, q]);

  const sortedByCh = useMemo(
    () =>
      [...novels].sort(
        (a, b) =>
          (b.translatedChaptersCount || b.chaptersCount) -
          (a.translatedChaptersCount || a.chaptersCount),
      ),
    [novels],
  );

  const featured = sortedByCh[0] ?? null;
  const picks = sortedByCh.slice(1, 5);
  const rank = profile ? getRank(profile.reading_seconds / 3600) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      {/* BENTO HERO (chỉ hiện khi không đang tìm kiếm từ khóa) */}
      {!q && !loading && !error && featured && (
        <section className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Cột 7/12: Tác phẩm trấn các */}
          <div
            className="relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 sm:p-8 lg:col-span-7"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 45px -20px rgba(180, 83, 9, 0.12)',
            }}
          >
            <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--brand)' }}>
              <ScrollIcon className="h-4 w-4" />
              Trấn Các Chi Bảo
            </div>

            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
              <Link
                to={`/novel/${featured.sourceId}/${encodeURIComponent(featured.id)}`}
                className="book-spine mx-auto w-36 shrink-0 overflow-hidden rounded-r-xl rounded-l-sm sm:mx-0 sm:w-44"
              >
                <img
                  src={overrides[`${featured.sourceId}:${featured.id}`] || featured.coverUrl || FALLBACK_COVER}
                  alt={featured.title}
                  className="aspect-[3/4] w-full object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <span
                  className="inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
                >
                  {genreLabel(guessGenre(featured))}
                </span>
                <h1
                  className="font-display mt-2 text-2xl font-bold leading-tight sm:text-4xl"
                  style={{ color: 'var(--ink)' }}
                >
                  {featured.title}
                </h1>
                {featured.author && (
                  <p className="mt-1 text-sm italic" style={{ color: 'var(--muted)' }}>
                    Tác giả: {featured.author}
                  </p>
                )}
                {featured.description && (
                  <p className="clamp-3 mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {featured.description}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    to={`/read/${featured.sourceId}/${encodeURIComponent(featured.id)}/1`}
                    className="inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-bold text-white shadow transition hover:opacity-90"
                    style={{ background: 'var(--brand)' }}
                  >
                    <BookOpenIcon className="h-4 w-4" />
                    Khởi đọc ngay
                  </Link>
                  <Link
                    to={`/novel/${featured.sourceId}/${encodeURIComponent(featured.id)}`}
                    className="inline-flex h-11 items-center gap-1.5 rounded-full border px-5 text-sm font-semibold transition hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                  >
                    Mục lục ({featured.translatedChaptersCount || featured.chaptersCount} ch)
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Cột 5/12: Bento phụ (Trạng thái tu luyện + Kinh thư đề cử) */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            {/* Tile 1: Đạo tâm / Tu vi của người đọc */}
            <div
              className="rounded-3xl p-5"
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
              }}
            >
              {user && profile && rank ? (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--brand)' }}>
                      Đạo Tịch Của Bạn
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--brand-strong)' }}>
                      <GemIcon className="h-3.5 w-3.5" /> {profile.spirit_stones} linh thạch
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <p className="font-display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
                      {rank.name}
                    </p>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {formatHours(profile.reading_seconds)} tu luyện
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${rank.progress}%`, background: 'var(--brand)' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-xl font-bold" style={{ color: 'var(--ink)' }}>
                      Bước vào con đường Tu Tiên
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                      Đọc truyện tích lũy giờ tu luyện, đột phá 15 cảnh giới & nhận linh thạch.
                    </p>
                  </div>
                  <Link
                    to="/auth"
                    className="shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white"
                    style={{ background: 'var(--brand)' }}
                  >
                    Nhập môn
                  </Link>
                </div>
              )}
            </div>

            {/* Tile 2: Tàng Kinh Tuyển Chọn */}
            <div
              className="flex-1 rounded-3xl p-5"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--muted)' }}>
                  Châu Ngọc Trong Các
                </span>
                <Link to="/genres" className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                  Tất cả →
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {picks.map((p) => (
                  <Link
                    key={`${p.sourceId}:${p.id}`}
                    to={`/novel/${p.sourceId}/${encodeURIComponent(p.id)}`}
                    className="flex items-center gap-2.5 rounded-xl p-2 transition hover:bg-[var(--surface-alt)]"
                  >
                    <img
                      src={overrides[`${p.sourceId}:${p.id}`] || p.coverUrl || FALLBACK_COVER}
                      alt={p.title}
                      className="h-14 w-10 shrink-0 rounded object-cover shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="clamp-1 font-display text-sm font-bold" style={{ color: 'var(--ink)' }}>
                        {p.title}
                      </p>
                      <p className="truncate text-[11px]" style={{ color: 'var(--muted)' }}>
                        {p.translatedChaptersCount || p.chaptersCount} chương
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Thanh phân loại kinh thư */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-display text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
            {q ? `Kết quả tìm kiếm "${searchParams.get('q')}"` : 'Tàng Kinh Các'}
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Hiện có {filtered.length} bộ điển籍 được lưu trữ
          </p>
        </div>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {GENRES.filter((g) => g.id !== 'khac').map((g) => {
            const active = genre === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setGenre(g.id)}
                className="cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition"
                style={
                  active
                    ? { background: 'var(--brand)', color: '#fff' }
                    : { background: 'var(--surface-alt)', color: 'var(--ink)' }
                }
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}

      {!loading && !error && filtered.length === 0 && (
        <p className="py-16 text-center italic" style={{ color: 'var(--muted)' }}>
          Chưa tìm thấy bộ truyện nào phù hợp.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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

/* ============================================================================
   2. TEMPLATE TRUYENC: Modern Super-App Portal (Spotlight + Top 10 Sidebar)
   ============================================================================ */
function TruyencHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const [genre, setGenre] = useState('all');

  const hot = useMemo(() => {
    const list = filterByGenre(novels, genre);
    const searched = q
      ? list.filter(
          (n) =>
            n.title.toLowerCase().includes(q) || (n.author ?? '').toLowerCase().includes(q),
        )
      : list;
    return [...searched].sort((a, b) => b.chaptersCount - a.chaptersCount);
  }, [novels, genre, q]);

  const topTen = useMemo(
    () => [...novels].sort((a, b) => b.chaptersCount - a.chaptersCount).slice(0, 10),
    [novels],
  );
  const spotlight = topTen[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6">
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      {/* SUPER-APP BANNER + QUICK STATS */}
      {!q && !loading && !error && spotlight && (
        <div
          className="relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-xl sm:p-8"
          style={{
            background: 'linear-gradient(125deg, #4c1d95 0%, #7c3aed 55%, #db2777 100%)',
          }}
        >
          <div className="relative z-10 grid items-center gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold tracking-wider uppercase backdrop-blur-md">
                <FlameIcon className="h-3.5 w-3.5" /> Siêu phẩm thịnh hành #1
              </span>
              <h1 className="font-display mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
                {spotlight.title}
              </h1>
              {spotlight.description && (
                <p className="clamp-2 mt-2 max-w-2xl text-sm text-white/85">
                  {spotlight.description}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to={`/read/${spotlight.sourceId}/${encodeURIComponent(spotlight.id)}/1`}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-6 text-sm font-extrabold text-purple-900 shadow-lg transition hover:scale-105"
                >
                  Đọc Ngay
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link
                  to={`/novel/${spotlight.sourceId}/${encodeURIComponent(spotlight.id)}`}
                  className="inline-flex h-11 items-center rounded-2xl bg-white/15 px-5 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/25"
                >
                  Chi tiết ({spotlight.chaptersCount} chương)
                </Link>
              </div>
            </div>
            <div className="hidden justify-end lg:col-span-4 lg:flex">
              <Link
                to={`/novel/${spotlight.sourceId}/${encodeURIComponent(spotlight.id)}`}
                className="w-36 rotate-3 overflow-hidden rounded-2xl border-2 border-white/40 shadow-2xl transition hover:rotate-0"
              >
                <img
                  src={overrides[`${spotlight.sourceId}:${spotlight.id}`] || spotlight.coverUrl || FALLBACK_COVER}
                  alt={spotlight.title}
                  className="aspect-[3/4] w-full object-cover"
                />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Pills thể loại cuộn ngang */}
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
        {GENRES.filter((g) => g.id !== 'khac').map((g) => {
          const active = genre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGenre(g.id)}
              className="shrink-0 cursor-pointer rounded-2xl px-4 py-2 text-xs font-bold whitespace-nowrap transition sm:text-sm"
              style={
                active
                  ? {
                      background: 'linear-gradient(135deg, var(--brand), var(--accent))',
                      color: '#fff',
                      boxShadow: '0 6px 20px -4px rgba(124, 58, 237, 0.45)',
                    }
                  : {
                      background: 'var(--card-bg)',
                      color: 'var(--muted)',
                      border: '1px solid var(--border)',
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

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cột trái 8/12: Lưới truyện */}
          <div className="lg:col-span-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display flex items-center gap-2 text-xl font-extrabold" style={{ color: 'var(--ink)' }}>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
                  style={{ background: 'var(--brand)' }}
                >
                  <FlameIcon className="h-4 w-4" />
                </span>
                {q ? `Kết quả cho "${searchParams.get('q')}"` : 'Truyện Đề Cử Mới'}
              </h2>
              <Link to="/genres" className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
                Xem tất cả →
              </Link>
            </div>

            {hot.length === 0 ? (
              <p className="py-16 text-center italic" style={{ color: 'var(--muted)' }}>
                Không có truyện nào trong mục này.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
                {hot.map((n) => (
                  <NovelCard
                    key={`${n.sourceId}:${n.id}`}
                    novel={n}
                    coverOverride={overrides[`${n.sourceId}:${n.id}`]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cột phải 4/12: Bảng Phong Thần Top 10 */}
          <aside className="lg:col-span-4">
            <div
              className="sticky top-20 rounded-3xl p-5 shadow-sm"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display flex items-center gap-2 text-lg font-extrabold" style={{ color: 'var(--ink)' }}>
                  <TrophyIcon className="h-5 w-5 text-amber-500" />
                  Top Đồộ Dài Đồ Sộ
                </h3>
                <span className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  Realtime
                </span>
              </div>
              <div className="space-y-2.5">
                {topTen.map((n, idx) => (
                  <Link
                    key={`${n.sourceId}:${n.id}`}
                    to={`/novel/${n.sourceId}/${encodeURIComponent(n.id)}`}
                    className="group flex items-center gap-3 rounded-2xl p-2 transition hover:bg-[var(--surface-alt)]"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold"
                      style={
                        idx === 0
                          ? { background: '#f59e0b', color: '#fff' }
                          : idx === 1
                            ? { background: '#94a3b8', color: '#fff' }
                            : idx === 2
                              ? { background: '#d97706', color: '#fff' }
                              : { background: 'var(--surface-alt)', color: 'var(--muted)' }
                      }
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="clamp-1 text-sm font-bold group-hover:text-[var(--brand)]" style={{ color: 'var(--ink)' }}>
                        {n.title}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        {genreLabel(guessGenre(n))} • {n.chaptersCount} chương
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   3. TEMPLATE DA-HUYEN-AO: Dark Fantasy Arcane Codex (RPG Grimoire)
   ============================================================================ */
function DaHuyenAoHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const [genre, setGenre] = useState('all');

  const filtered = useMemo(() => {
    const list = filterByGenre(novels, genre);
    if (!q) return list;
    return list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || (n.author ?? '').toLowerCase().includes(q),
    );
  }, [novels, genre, q]);

  const relic = filtered[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      {/* Arcane Altar Spotlight */}
      {!q && !loading && !error && relic && (
        <section
          className="arcane-card relative mb-10 overflow-hidden rounded-3xl p-6 sm:p-10"
          style={{
            background:
              'radial-gradient(circle at 80% 20%, rgba(34, 211, 238, 0.16), transparent 45%), radial-gradient(circle at 20% 80%, rgba(168, 85, 247, 0.25), rgba(12, 8, 24, 0.96) 70%)',
          }}
        >
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[11px] font-bold tracking-[0.22em] uppercase"
                style={{ borderColor: 'rgba(34,211,238,0.4)', color: 'var(--accent)', background: 'rgba(8,6,18,0.6)' }}
              >
                <SparklesIcon className="h-3.5 w-3.5" /> Thượng Cổ Chân Kinh
              </div>
              <h1
                className="font-display mt-4 text-3xl font-bold tracking-wide sm:text-5xl"
                style={{ color: 'var(--ink)', textShadow: '0 0 28px rgba(168,85,247,0.45)' }}
              >
                {relic.title}
              </h1>
              {relic.author && (
                <p className="font-mono-tech mt-2 text-xs tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
                  Tác giả: {relic.author} // {relic.chaptersCount} Chương
                </p>
              )}
              {relic.description && (
                <p className="clamp-3 mt-4 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {relic.description}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={`/read/${relic.sourceId}/${encodeURIComponent(relic.id)}/1`}
                  className="inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
                  style={{
                    background: 'linear-gradient(135deg, #9333ea, #06b6d4)',
                    boxShadow: '0 0 24px rgba(168, 85, 247, 0.5)',
                  }}
                >
                  Lĩnh Ngộ Ngay
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link
                  to={`/novel/${relic.sourceId}/${encodeURIComponent(relic.id)}`}
                  className="inline-flex h-11 items-center rounded-xl border px-5 text-sm font-semibold transition hover:bg-white/5"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                >
                  Mở Pháp Điển
                </Link>
              </div>
            </div>
            <div className="flex justify-center lg:col-span-4">
              <Link
                to={`/novel/${relic.sourceId}/${encodeURIComponent(relic.id)}`}
                className="relative w-44 overflow-hidden rounded-2xl border-2 p-1.5 shadow-2xl"
                style={{
                  borderColor: 'rgba(34,211,238,0.5)',
                  boxShadow: '0 0 40px rgba(168,85,247,0.4)',
                }}
              >
                <img
                  src={overrides[`${relic.sourceId}:${relic.id}`] || relic.coverUrl || FALLBACK_COVER}
                  alt={relic.title}
                  className="aspect-[3/4] w-full rounded-xl object-cover"
                />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Rune Filter Pills */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold tracking-wider uppercase" style={{ color: 'var(--ink)' }}>
          ✦ Pháp Điển Tàng Thư ({filtered.length})
        </h2>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {GENRES.filter((g) => g.id !== 'khac').map((g) => {
            const active = genre === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setGenre(g.id)}
                className="font-mono-tech cursor-pointer rounded-xl border px-3.5 py-1.5 text-xs font-bold tracking-wider uppercase whitespace-nowrap transition"
                style={
                  active
                    ? {
                        borderColor: 'var(--accent)',
                        background: 'rgba(34, 211, 238, 0.15)',
                        color: 'var(--accent)',
                      }
                    : {
                        borderColor: 'var(--border)',
                        background: 'var(--card-bg)',
                        color: 'var(--muted)',
                      }
                }
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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

/* ============================================================================
   4. TEMPLATE CO-PHONG: Oriental Scroll & Vermilion Seal
   ============================================================================ */
function CoPhongHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const [genre, setGenre] = useState('all');

  const filtered = useMemo(() => {
    const list = filterByGenre(novels, genre);
    if (!q) return list;
    return list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || (n.author ?? '').toLowerCase().includes(q),
    );
  }, [novels, genre, q]);

  const topScroll = filtered[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      {/* Bức trướng quyển thư đầu trang */}
      {!q && !loading && !error && topScroll && (
        <section className="cophong-frame mb-10 p-6 sm:p-10">
          <div className="grid items-center gap-8 md:grid-cols-12">
            <div className="md:col-span-4 flex justify-center">
              <Link
                to={`/novel/${topScroll.sourceId}/${encodeURIComponent(topScroll.id)}`}
                className="w-44 overflow-hidden border-2 p-1.5 shadow-md"
                style={{ borderColor: 'var(--border)', background: 'var(--page-bg)' }}
              >
                <img
                  src={overrides[`${topScroll.sourceId}:${topScroll.id}`] || topScroll.coverUrl || FALLBACK_COVER}
                  alt={topScroll.title}
                  className="aspect-[3/4] w-full object-cover"
                />
              </Link>
            </div>
            <div className="md:col-span-8 text-center md:text-left">
              <div className="inline-flex items-center gap-2">
                <span className="cophong-seal px-2.5 py-0.5 text-xs">THƯỢNG PHẨM</span>
                <span className="text-xs tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
                  • {genreLabel(guessGenre(topScroll)).toUpperCase()}
                </span>
              </div>
              <h1
                className="font-display mt-3 text-3xl font-bold leading-snug sm:text-4xl"
                style={{ color: 'var(--ink)' }}
              >
                {topScroll.title}
              </h1>
              {topScroll.author && (
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                  Trước tác: <strong style={{ color: 'var(--ink)' }}>{topScroll.author}</strong>
                </p>
              )}
              {topScroll.description && (
                <p className="clamp-3 mt-4 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {topScroll.description}
                </p>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                <Link
                  to={`/read/${topScroll.sourceId}/${encodeURIComponent(topScroll.id)}/1`}
                  className="inline-flex h-10 items-center gap-2 px-6 text-sm font-bold text-white shadow"
                  style={{ background: 'var(--brand)' }}
                >
                  Khai Quyển Đọc Ngay
                </Link>
                <Link
                  to={`/novel/${topScroll.sourceId}/${encodeURIComponent(topScroll.id)}`}
                  className="inline-flex h-10 items-center border px-5 text-sm font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                >
                  Xem Mục Lục ({topScroll.chaptersCount} chương)
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Thẻ gỗ chọn thể loại */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3">
          <span className="h-px w-12" style={{ background: 'var(--border)' }} />
          <h2 className="font-display text-2xl font-bold tracking-widest" style={{ color: 'var(--ink)' }}>
            DANH TÁC TRONG CÁC
          </h2>
          <span className="h-px w-12" style={{ background: 'var(--border)' }} />
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {GENRES.filter((g) => g.id !== 'khac').map((g) => {
            const active = genre === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setGenre(g.id)}
                className="font-display cursor-pointer border px-4 py-1.5 text-sm font-semibold transition"
                style={
                  active
                    ? {
                        borderColor: 'var(--brand)',
                        background: 'var(--brand)',
                        color: '#fff',
                      }
                    : {
                        borderColor: 'var(--border)',
                        background: 'var(--card-bg)',
                        color: 'var(--ink)',
                      }
                }
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
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

/* ============================================================================
   5. TEMPLATE TOI-GIAN: Swiss Modernism 2.0 (12-Column Architectural Grid)
   ============================================================================ */
function ToiGianHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const [genre, setGenre] = useState('all');

  const filtered = useMemo(() => {
    const list = filterByGenre(novels, genre);
    if (!q) return list;
    return list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || (n.author ?? '').toLowerCase().includes(q),
    );
  }, [novels, genre, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      {/* Swiss Typographic Manifesto Header */}
      <div
        className="mb-8 grid grid-cols-1 border-b pb-8 lg:grid-cols-12"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="lg:col-span-8">
          <p className="font-mono-tech text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--brand)' }}>
            SWISS EDITION // LITERARY ARCHIVE
          </p>
          <h1
            className="font-display mt-2 text-4xl font-black tracking-tighter uppercase sm:text-6xl"
            style={{ color: 'var(--ink)' }}
          >
            {q ? `SEARCH: ${searchParams.get('q')}` : 'INDEX OF NOVELS.'}
          </h1>
        </div>
        <div className="mt-4 flex flex-col justify-end lg:col-span-4 lg:mt-0 lg:items-end">
          <p className="font-mono-tech text-xs uppercase" style={{ color: 'var(--muted)' }}>
            TOTAL WORKS AVAILABLE: <strong>{filtered.length}</strong>
          </p>
          <p className="font-mono-tech mt-1 text-xs uppercase" style={{ color: 'var(--muted)' }}>
            SYSTEM: REALTIME SUPABASE SYNC
          </p>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="mb-8 flex flex-wrap border-t border-l" style={{ borderColor: 'var(--border)' }}>
        {GENRES.filter((g) => g.id !== 'khac').map((g) => {
          const active = genre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGenre(g.id)}
              className="font-mono-tech cursor-pointer border-r border-b px-4 py-2 text-xs font-bold uppercase transition"
              style={{
                borderColor: 'var(--border)',
                background: active ? 'var(--ink)' : 'var(--card-bg)',
                color: active ? 'var(--page-bg)' : 'var(--ink)',
              }}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}

      {/* Strict Mathematical Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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

/* ============================================================================
   6. TEMPLATE TINH-HA: Cinematic Widescreen Editorial
   ============================================================================ */
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
          className="font-display mt-1 text-3xl font-semibold sm:text-4xl"
          style={{ color: 'var(--ink)' }}
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
      {featured && !loading && !error && !q && (
        <section className="relative overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
          {featuredCover && (
            <div className="absolute inset-0" aria-hidden="true">
              <img
                src={featuredCover}
                alt=""
                className="h-full w-full scale-105 object-cover object-top blur-[2px]"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, var(--page-bg) 8%, color-mix(in srgb, var(--page-bg) 68%, transparent) 48%, color-mix(in srgb, var(--page-bg) 35%, transparent) 100%), linear-gradient(to right, var(--page-bg) 0%, color-mix(in srgb, var(--page-bg) 72%, transparent) 48%, transparent 85%)',
                }}
              />
            </div>
          )}
          <div className="relative mx-auto flex min-h-[54vh] max-w-7xl flex-col justify-end px-4 pb-12 pt-20 sm:min-h-[64vh] sm:px-6 sm:pb-16">
            <div className="max-w-2xl">
              <p
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em]"
                style={{ color: 'var(--brand)' }}
              >
                <FlameIcon className="h-4 w-4" />
                Tác phẩm tâm điểm
              </p>
              <h1
                className="font-display mt-3 text-4xl font-bold leading-[1.06] sm:text-6xl"
                style={{ color: 'var(--ink)' }}
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
                {featured.translatedChaptersCount || featured.chaptersCount} chương đã dịch
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to={`/read/${featured.sourceId}/${encodeURIComponent(featured.id)}/1`}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 text-base font-bold text-white shadow-lg transition hover:opacity-90"
                  style={{ background: 'var(--brand)' }}
                >
                  Đọc ngay
                  <ArrowRightIcon className="h-5 w-5" />
                </Link>
                <Link
                  to={`/novel/${featured.sourceId}/${encodeURIComponent(featured.id)}`}
                  className="inline-flex min-h-[48px] items-center rounded-full px-7 text-base font-semibold transition hover:opacity-80"
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--ink)',
                    background: 'color-mix(in srgb, var(--card-bg) 78%, transparent)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  Chi tiết tác phẩm
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
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
            placeholder="Tìm tác phẩm, tác giả..."
            aria-label="Tìm truyện"
            className="min-h-[52px] w-full rounded-full bg-[var(--card-bg)] pl-12 pr-5 text-base outline-none transition"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--ink)',
            }}
          />
        </form>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock error={error} />}
        {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

        {!loading && !error && !q && latest.length > 0 && (
          <section className="mb-12" aria-label="Mới cập nhật">
            <TinhHaSectionHeader overline="Tinh Hà Thư Viện" title="Mới cập nhật" moreTo="/genres" />
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

        {!loading && !error && filtered.length > 0 && (
          <section aria-label={q ? 'Kết quả tìm kiếm' : 'Toàn bộ truyện'}>
            <TinhHaSectionHeader
              overline={q ? 'Tìm kiếm' : 'Danh mục biên tập'}
              title={q ? `Kết quả cho "${searchParams.get('q')}"` : 'Toàn bộ tác phẩm'}
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
  if (template === 'da-huyen-ao') return <DaHuyenAoHome />;
  if (template === 'co-phong') return <CoPhongHome />;
  if (template === 'toi-gian') return <ToiGianHome />;
  if (template === 'tinh-ha') return <TinhHaHome />;
  return <ThuCacHome />;
}

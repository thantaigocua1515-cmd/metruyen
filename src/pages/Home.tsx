import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTemplate } from '../context/TemplateContext';
import { useAuth } from '../context/AuthContext';
import { useNovels } from '../lib/useNovels';
import { GENRES, filterByGenre } from '../lib/genres';
import {
  TinhHaVerticalCard,
  TinhHaRowCard,
  ThuCacCard,
  TruyencCard,
  DaHuyenAoCard,
  CoPhongCard,
  ToiGianCard,
} from '../components/NovelCard';
import {
  ArrowRightIcon,
  FlameIcon,
  GridIcon,
  ListIcon,
  SparklesIcon,
} from '../components/icons';
import type { NovelSummary } from '../lib/novelApi';

function LoadingBlock({ message = 'Đang mở thư tịch...' }: { message?: string }) {
  return (
    <div className="py-20 text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
        style={{ color: 'var(--brand)' }}
      />
      <p className="mt-3 text-sm font-medium" style={{ color: 'var(--muted)' }}>
        {message}
      </p>
    </div>
  );
}

function ErrorBlock({ error }: { error: string }) {
  return (
    <div className="mx-auto my-8 max-w-xl rounded-2xl border border-red-300 bg-red-50 p-5 text-center text-sm text-red-700 shadow-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
      ⚠️ {error}
    </div>
  );
}

function SyncHint({ liveSourceIds }: { liveSourceIds: string[] }) {
  const { isAdmin } = useAuth();
  if (!isAdmin || liveSourceIds.length === 0) return null;
  return (
    <p
      className="mx-auto mb-6 max-w-2xl rounded-2xl px-4 py-2.5 text-center text-xs shadow-sm"
      style={{
        background: 'var(--brand-soft)',
        color: 'var(--brand-strong)',
        border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)',
      }}
    >
      💡 Một số nguồn đang đọc trực tiếp từ API. Vào{' '}
      <Link to="/admin" className="font-bold underline">
        Quản trị SaaS → 🔄 Đồng bộ
      </Link>{' '}
      để lưu truyện về database (đọc nhanh hơn, mục lục chuẩn).
    </p>
  );
}

/* =========================================================
   1. THƯ CÁC TU TIÊN (thu-cac) — Tàng Kinh Các Tiên Môn
   ========================================================= */
function ThuCacHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [selectedGenre, setSelectedGenre] = useState('all');

  const filtered = useMemo(() => {
    return filterByGenre(novels, selectedGenre);
  }, [novels, selectedGenre]);

  const topDivine = useMemo(() => {
    return [...novels].sort((a, b) => b.chaptersCount - a.chaptersCount).slice(0, 6);
  }, [novels]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Hero Banner Thư Các */}
      <section className="relative mb-12 overflow-hidden rounded-3xl border border-amber-900/20 bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900/90 p-8 text-amber-50 shadow-2xl sm:p-12">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-400/30 px-3.5 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase">
            📜 Tàng Kinh Các Tiên Môn
          </span>
          <h1
            className="mt-4 text-3xl font-extrabold sm:text-5xl leading-tight tracking-wide text-amber-100"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Vạn Giới Tiên Thư · Vấn Đạo Trường Sinh
          </h1>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-amber-200/80">
            Hơn hàng nghìn bộ ngọc giản thần thông, tu chân, kiếm hiệp từ khắp các đại tông môn. Đọc sách đắc ngộ, tăng tiến tu vi, thu thập linh thạch.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/genres"
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-bold text-amber-950 shadow-lg shadow-amber-600/30 transition hover:opacity-95"
            >
              Khai Mở Tàng Thư
            </Link>
            <Link
              to="/leaderboard"
              className="rounded-xl border border-amber-500/30 bg-black/40 px-6 py-2.5 text-sm font-semibold text-amber-200 backdrop-blur-md transition hover:bg-black/60"
            >
              Bảng Xếp Hạng Tu Vi
            </Link>
          </div>
        </div>
      </section>

      {/* Thể loại Đạo Môn */}
      <div className="mb-8">
        <div className="flex items-center justify-between pb-3">
          <h2
            className="text-xl font-bold tracking-wide text-amber-950 dark:text-amber-100"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            🏛️ Đạo Tàng Phân Loại
          </h2>
          <Link to="/genres" className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline">
            Toàn bộ thể loại →
          </Link>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {GENRES.map((g) => {
            const active = selectedGenre === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGenre(g.id)}
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-amber-700 text-amber-50 shadow-md shadow-amber-900/20'
                    : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border border-amber-900/15 dark:border-amber-100/10 hover:border-amber-500'
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <LoadingBlock message="Đang thỉnh kinh từ các tông môn..." />}
      {error && <ErrorBlock error={error} />}
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      {/* Ngọc Giản Thần Phẩm (Top truyện) */}
      {!loading && !error && topDivine.length > 0 && selectedGenre === 'all' && (
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between border-b border-amber-900/15 pb-2 dark:border-amber-100/10">
            <h2
              className="text-2xl font-bold text-amber-950 dark:text-amber-100"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              ✨ Ngọc Giản Thần Phẩm
            </h2>
            <span className="text-xs text-amber-700 dark:text-amber-400">
              Chương tiết phong phú nhất
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">
            {topDivine.map((n) => (
              <ThuCacCard
                key={`divine:${n.sourceId}:${n.id}`}
                novel={n}
                coverOverride={overrides[`${n.sourceId}:${n.id}`]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Toàn bộ ngọc giản */}
      {!loading && !error && (
        <section>
          <div className="mb-4 flex items-center justify-between border-b border-amber-900/15 pb-2 dark:border-amber-100/10">
            <h2
              className="text-2xl font-bold text-amber-950 dark:text-amber-100"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              📚 Vạn Quyển Thư Tịch ({filtered.length})
            </h2>
          </div>
          {filtered.length === 0 ? (
            <p className="py-16 text-center italic text-stone-500">Chưa có truyện nào trong mục này.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((n) => (
                <ThuCacCard
                  key={`${n.sourceId}:${n.id}`}
                  novel={n}
                  coverOverride={overrides[`${n.sourceId}:${n.id}`]}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* =========================================================
   2. TRUYENC HIỆN ĐẠI (truyenc) — App Webtoon Next-Gen
   ========================================================= */
function TruyencHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [genre, setGenre] = useState('all');

  const hot = useMemo(() => {
    const list = filterByGenre(novels, genre);
    return [...list].sort((a, b) => b.chaptersCount - a.chaptersCount);
  }, [novels, genre]);

  const spotlight = useMemo(() => {
    return novels[0] || null;
  }, [novels]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
      {/* Spotlight Carousel / Hero Card */}
      {spotlight && !loading && (
        <div className="relative mb-8 overflow-hidden rounded-[28px] bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 p-6 sm:p-10 text-white shadow-xl shadow-purple-900/20">
          <div className="flex flex-col-reverse sm:flex-row items-center gap-6">
            <div className="flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wide text-white shadow-md">
                <FlameIcon className="h-3.5 w-3.5" /> BẬT NHẤT TUẦN NÀY
              </span>
              <h2 className="mt-3 text-2xl font-black sm:text-4xl tracking-tight text-white">
                {spotlight.title}
              </h2>
              {spotlight.author && (
                <p className="mt-1 text-sm font-medium text-purple-200">
                  Tác giả: {spotlight.author}
                </p>
              )}
              {spotlight.description && (
                <p className="clamp-2 mt-2 text-sm text-purple-200/90 leading-relaxed">
                  {spotlight.description}
                </p>
              )}
              <div className="mt-5 flex items-center gap-3">
                <Link
                  to={`/read/${spotlight.sourceId}/${encodeURIComponent(spotlight.id)}/1`}
                  className="rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-7 py-3 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:scale-105"
                >
                  Đọc ngay bây giờ
                </Link>
                <Link
                  to={`/novel/${spotlight.sourceId}/${encodeURIComponent(spotlight.id)}`}
                  className="rounded-full bg-white/10 backdrop-blur-md px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Xem chi tiết
                </Link>
              </div>
            </div>
            <div className="w-36 sm:w-48 shrink-0">
              <img
                src={overrides[`${spotlight.sourceId}:${spotlight.id}`] || spotlight.coverUrl || ''}
                alt={spotlight.title}
                className="aspect-[3/4] w-full rounded-2xl object-cover shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tiêu đề mục Hot & Pills Thể Loại */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 text-xl text-white shadow-md shadow-purple-500/25">
            🔥
          </span>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Truyện Thịnh Hành
          </h2>
        </div>
        <Link
          to="/genres"
          className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:underline"
        >
          Khám phá tất cả ›
        </Link>
      </div>

      {/* Pills thể loại */}
      <div className="no-scrollbar -mx-3 mt-4 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
        {GENRES.map((g) => {
          const active = genre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGenre(g.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-xs font-extrabold transition ${
                active
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/30'
                  : 'bg-white dark:bg-[#1a152e] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-purple-900/40 hover:border-purple-400'
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {loading && <LoadingBlock message="Đang tải các truyện hot..." />}
      {error && <ErrorBlock error={error} />}
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5 xl:grid-cols-6">
        {hot.map((n) => (
          <TruyencCard
            key={`${n.sourceId}:${n.id}`}
            novel={n}
            coverOverride={overrides[`${n.sourceId}:${n.id}`]}
          />
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   3. DẠ HUYỀN ẢO (da-huyen-ao) — Dark Fantasy Neon Abyss
   ========================================================= */
function DaHuyenAoHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [selectedGenre, setSelectedGenre] = useState('all');

  const filtered = useMemo(() => {
    return filterByGenre(novels, selectedGenre);
  }, [novels, selectedGenre]);

  const featuredAbyss = useMemo(() => {
    return novels[0] || null;
  }, [novels]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Hero Vực Thẳm Huyền Bí */}
      {featuredAbyss && !loading && (
        <section className="relative mb-12 overflow-hidden rounded-3xl border border-purple-500/30 bg-[#0d091e] p-8 sm:p-12 shadow-[0_0_40px_rgba(139,92,246,0.18)]">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />
          <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-cyan-600/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <span className="inline-flex items-center gap-2 rounded-lg bg-purple-950/80 border border-purple-500/40 px-3.5 py-1 text-xs font-mono font-bold uppercase tracking-widest text-cyan-300">
                ✦ CẤM THUẬT & MA ĐIỂN
              </span>
              <h1
                className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-wide text-purple-100"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {featuredAbyss.title}
              </h1>
              {featuredAbyss.author && (
                <p className="mt-2 text-sm font-mono text-purple-300">
                  U Linh Tác Giả: {featuredAbyss.author}
                </p>
              )}
              {featuredAbyss.description && (
                <p className="clamp-3 mt-3 text-sm text-purple-200/70 leading-relaxed font-sans">
                  {featuredAbyss.description}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  to={`/read/${featuredAbyss.sourceId}/${encodeURIComponent(featuredAbyss.id)}/1`}
                  className="rounded-xl border border-purple-400 bg-purple-600 px-7 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.45)] transition hover:bg-purple-500"
                >
                  Khai Mở Ma Thư
                </Link>
                <Link
                  to={`/novel/${featuredAbyss.sourceId}/${encodeURIComponent(featuredAbyss.id)}`}
                  className="rounded-xl border border-purple-500/30 bg-[#17102e] px-6 py-3 text-sm font-semibold text-purple-200 transition hover:border-purple-400"
                >
                  Xem Bản Đồ
                </Link>
              </div>
            </div>
            <div className="w-44 sm:w-56 shrink-0">
              <img
                src={overrides[`${featuredAbyss.sourceId}:${featuredAbyss.id}`] || featuredAbyss.coverUrl || ''}
                alt={featuredAbyss.title}
                className="aspect-[3/4] w-full rounded-2xl object-cover border border-purple-500/40 shadow-[0_0_30px_rgba(139,92,246,0.35)]"
              />
            </div>
          </div>
        </section>
      )}

      {/* Thể loại U Linh */}
      <div className="mb-8">
        <h2
          className="text-2xl font-bold tracking-wider text-purple-200 mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          🔮 U MINH BÍ GIỚI
        </h2>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {GENRES.map((g) => {
            const active = selectedGenre === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGenre(g.id)}
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-mono font-bold transition ${
                  active
                    ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-400'
                    : 'bg-[#120c24] text-purple-300 border border-purple-500/25 hover:border-purple-400'
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <LoadingBlock message="Đang triệu hồi tà thư dị giới..." />}
      {error && <ErrorBlock error={error} />}
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5 xl:grid-cols-6">
        {filtered.map((n) => (
          <DaHuyenAoCard
            key={`${n.sourceId}:${n.id}`}
            novel={n}
            coverOverride={overrides[`${n.sourceId}:${n.id}`]}
          />
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   4. CỔ PHONG (co-phong) — Thủy Mặc Giang Hồ & Giấy Dó
   ========================================================= */
function CoPhongHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [selectedGenre, setSelectedGenre] = useState('all');

  const filtered = useMemo(() => {
    return filterByGenre(novels, selectedGenre);
  }, [novels, selectedGenre]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Khung câu đối hoành phi */}
      <div className="mb-10 text-center border-y-2 border-red-900/30 dark:border-red-500/30 py-6">
        <span className="seal-stamp text-xs">[ 江 湖 奇 書 ]</span>
        <h1
          className="mt-2 text-3xl sm:text-5xl font-bold tracking-widest text-stone-900 dark:text-stone-100"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          HỒI THỨ NHẤT: THIÊN HẠ KỲ THƯ
        </h1>
        <p className="mt-2 text-sm font-serif italic text-stone-600 dark:text-stone-400">
          "Trượng kiếm hồng trần lưu lạc khách · Nhất hồ trọc tửu thoại tang thương"
        </p>
      </div>

      {/* Thể loại kiếm hiệp */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {GENRES.map((g) => {
          const active = selectedGenre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setSelectedGenre(g.id)}
              className={`rounded px-4 py-1.5 text-xs font-serif font-bold transition ${
                active
                  ? 'border-2 border-red-800 bg-red-800 text-amber-50 shadow-sm'
                  : 'border border-stone-300 dark:border-stone-700 bg-[#fdfbf7] dark:bg-[#20180f] text-stone-800 dark:text-stone-200 hover:border-red-700'
              }`}
            >
              【{g.label}】
            </button>
          );
        })}
      </div>

      {loading && <LoadingBlock message="Đang lật mở trang sách cổ..." />}
      {error && <ErrorBlock error={error} />}
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5 xl:grid-cols-6">
        {filtered.map((n) => (
          <CoPhongCard
            key={`${n.sourceId}:${n.id}`}
            novel={n}
            coverOverride={overrides[`${n.sourceId}:${n.id}`]}
          />
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   5. TỐI GIẢN (toi-gian) — Swiss Modernist Minimal
   ========================================================= */
function ToiGianHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = filterByGenre(novels, selectedGenre);
    if (q) {
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || (n.author ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [novels, selectedGenre, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header tối giản */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-400">
            INDEX / ARCHIVE / {filtered.length} TITLES
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Publications
          </h1>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 transition ${viewMode === 'grid' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-400 hover:text-black'}`}
            title="Grid view"
          >
            <GridIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 transition ${viewMode === 'list' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-400 hover:text-black'}`}
            title="List view"
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category selector */}
      <div className="no-scrollbar mb-8 flex gap-3 overflow-x-auto pb-1 text-xs font-mono">
        {GENRES.map((g, idx) => {
          const active = selectedGenre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setSelectedGenre(g.id)}
              className={`shrink-0 transition-colors uppercase ${
                active
                  ? 'font-bold text-black dark:text-white underline underline-offset-4'
                  : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              [{String(idx + 1).padStart(2, '0')}] {g.label}
            </button>
          );
        })}
      </div>

      {loading && <LoadingBlock message="Loading index records..." />}
      {error && <ErrorBlock error={error} />}
      {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((n) => (
            <ToiGianCard
              key={`${n.sourceId}:${n.id}`}
              novel={n}
              coverOverride={overrides[`${n.sourceId}:${n.id}`]}
            />
          ))}
        </div>
      ) : (
        /* List View cho Tối Giản */
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
          {filtered.map((n) => (
            <Link
              key={`list:${n.sourceId}:${n.id}`}
              to={`/novel/${n.sourceId}/${encodeURIComponent(n.id)}`}
              className="group flex items-center justify-between py-3 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="font-mono text-xs text-zinc-400 w-12 shrink-0">
                  {n.sourceName.slice(0, 4)}
                </span>
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:underline truncate">
                  {n.title}
                </span>
                {n.author && (
                  <span className="hidden sm:inline font-mono text-xs text-zinc-400 truncate">
                    — {n.author}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0 font-mono text-xs text-zinc-400">
                <span>{n.chaptersCount} CH</span>
                <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   6. TINH HÀ (tinh-ha) — Cinematic Starlight & Luxury
   ========================================================= */
function TinhHaHome() {
  const { novels, overrides, loading, error, liveSourceIds } = useNovels();
  const [searchParams] = useSearchParams();
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
      (n) => n.title.toLowerCase().includes(q) || (n.author ?? '').toLowerCase().includes(q),
    );
  }, [novels, q]);

  const latest = useMemo(() => filtered.slice(0, 12), [filtered]);
  const featuredCover = featured
    ? overrides[`${featured.sourceId}:${featured.id}`] || featured.coverUrl
    : null;

  return (
    <div>
      {/* HERO điện ảnh */}
      {featured && !loading && !error && (
        <section className="relative overflow-hidden min-h-[55vh] sm:min-h-[72vh] flex items-end">
          {featuredCover && (
            <div className="absolute inset-0" aria-hidden="true">
              <img
                src={featuredCover}
                alt=""
                className="h-full w-full object-cover object-top filter brightness-75"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, var(--page-bg) 6%, color-mix(in srgb, var(--page-bg) 68%, transparent) 45%, transparent 80%), linear-gradient(to right, color-mix(in srgb, var(--page-bg) 85%, transparent) 0%, transparent 65%)',
                }}
              />
            </div>
          )}
          <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16 w-full">
            <div className="max-w-2xl">
              <p
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em]"
                style={{ color: 'var(--brand)' }}
              >
                <SparklesIcon className="h-4 w-4" />
                ĐỀ CỬ TINH HÀ
              </p>
              <h1
                className="mt-3 text-4xl font-bold leading-[1.05] sm:text-6xl text-amber-950 dark:text-amber-100"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {featured.title}
              </h1>
              {featured.author && (
                <p className="mt-2 text-sm font-medium uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Tác giả: {featured.author}
                </p>
              )}
              {featured.description && (
                <p className="clamp-3 mt-3 max-w-xl text-sm sm:text-base leading-relaxed text-stone-700 dark:text-stone-300">
                  {featured.description}
                </p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to={`/read/${featured.sourceId}/${encodeURIComponent(featured.id)}/1`}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-8 text-base font-bold text-amber-950 shadow-xl transition hover:opacity-95 bg-amber-400 hover:bg-amber-300"
                >
                  Đọc ngay
                  <ArrowRightIcon className="h-5 w-5" />
                </Link>
                <Link
                  to={`/novel/${featured.sourceId}/${encodeURIComponent(featured.id)}`}
                  className="inline-flex min-h-[48px] items-center rounded-full px-8 text-base font-semibold transition hover:opacity-85 border border-amber-500/30 bg-black/30 backdrop-blur-md text-amber-100"
                >
                  Chi tiết
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {loading && <LoadingBlock message="Đang khởi tạo bầu trời tinh hà..." />}
        {error && <ErrorBlock error={error} />}
        {!loading && !error && <SyncHint liveSourceIds={liveSourceIds} />}

        {/* Hàng cuộn ngang Mới Cập Nhật */}
        {!loading && !error && !q && latest.length > 0 && (
          <section className="mb-14">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
                  THƯ TỊCH
                </p>
                <h2
                  className="text-3xl font-semibold sm:text-4xl text-amber-950 dark:text-amber-100"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Mới Cập Nhật
                </h2>
              </div>
              <Link to="/genres" className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                Xem tất cả ›
              </Link>
            </div>
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {latest.map((n) => (
                <TinhHaVerticalCard
                  key={`th:${n.sourceId}:${n.id}`}
                  novel={n}
                  coverOverride={overrides[`${n.sourceId}:${n.id}`]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Toàn bộ truyện dạng Row Card */}
        {!loading && !error && filtered.length > 0 && (
          <section>
            <div className="mb-6">
              <h2
                className="text-3xl font-semibold sm:text-4xl text-amber-950 dark:text-amber-100"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {q ? `Kết quả tìm kiếm cho "${q}"` : 'Toàn Bộ Thư Tịch'}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
              {filtered.map((n) => (
                <TinhHaRowCard
                  key={`thr:${n.sourceId}:${n.id}`}
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

/* =========================================================
   ROUTER TRANG CHỦ THEO 6 BỘ GIAO DIỆN
   ========================================================= */
export default function Home() {
  const { template } = useTemplate();

  switch (template) {
    case 'truyenc':
      return <TruyencHome />;
    case 'da-huyen-ao':
      return <DaHuyenAoHome />;
    case 'co-phong':
      return <CoPhongHome />;
    case 'toi-gian':
      return <ToiGianHome />;
    case 'tinh-ha':
      return <TinhHaHome />;
    case 'thu-cac':
    default:
      return <ThuCacHome />;
  }
}

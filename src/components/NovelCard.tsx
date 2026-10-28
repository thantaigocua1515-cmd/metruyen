import { Link } from 'react-router-dom';
import type { NovelSummary } from '../lib/novelApi';
import { useTemplate } from '../context/TemplateContext';
import { genreLabel, guessGenre } from '../lib/genres';
import { ArrowRightIcon, BookOpenIcon, FlameIcon, StarIcon } from './icons';

export interface NovelCardProps {
  novel: NovelSummary;
  coverOverride?: string | null;
}

const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d1f3f"/><stop offset="1" stop-color="#0e0a18"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><text x="150" y="210" font-size="64" text-anchor="middle" fill="#d4af37">📚</text></svg>`,
  );

function isCompleted(novel: NovelSummary): boolean {
  return !!novel.status && /complet|full|hoàn thành|done/i.test(novel.status);
}

/* =========================================================
   1. THƯ CÁC TU TIÊN (thu-cac) — Thẻ Ngọc Giản Khảm Gỗ
   ========================================================= */
export function ThuCacCard({ novel, coverOverride }: NovelCardProps) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  const hot = novel.chaptersCount >= 1000;

  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group relative flex flex-col overflow-hidden rounded-xl bg-[var(--card-bg)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_30px_rgba(180,83,9,0.18)]"
      style={{
        border: '1px solid color-mix(in srgb, var(--brand) 28%, transparent)',
      }}
    >
      {/* Khung ảnh ngọc giản */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-200 dark:bg-stone-900">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-black/25 opacity-70 group-hover:opacity-60 transition" />

        {/* Huy hiệu Tiên Môn */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1 items-start">
          {hot && (
            <span className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-amber-950 shadow-md backdrop-blur-md bg-amber-400">
              <FlameIcon className="h-3 w-3" />
              Thần Phẩm
            </span>
          )}
          <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-amber-200 backdrop-blur-md bg-black/60 border border-amber-500/30">
            {novel.sourceName}
          </span>
        </div>

        {/* Số chương kiểu ngọc giản */}
        <div className="absolute bottom-2.5 right-2.5 rounded-md px-2 py-0.5 text-[11px] font-medium text-amber-100 bg-amber-950/80 backdrop-blur-sm border border-amber-600/30">
          📜 {readable} quyển
        </div>
      </div>

      {/* Thông tin thư tịch */}
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          {genreLabel(guessGenre(novel))}
        </p>
        <h3
          className="clamp-2 mt-1 text-sm font-bold leading-snug group-hover:text-amber-600 transition"
          style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">
            ✍️ {novel.author}
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-stone-500 border-t border-amber-900/10 dark:border-amber-100/10">
          <span>{novel.chaptersCount} hồi</span>
          <span className="font-semibold text-amber-700 dark:text-amber-300 group-hover:translate-x-0.5 transition-transform">
            Vấn đạo →
          </span>
        </div>
      </div>
    </Link>
  );
}

/* =========================================================
   2. TRUYENC HIỆN ĐẠI (truyenc) — Thẻ Webtoon App Tím Tròn
   ========================================================= */
export function TruyencCard({ novel, coverOverride }: NovelCardProps) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const hot = novel.chaptersCount >= 1000;
  const full = isCompleted(novel);

  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group relative flex flex-col overflow-hidden rounded-[22px] bg-white dark:bg-[#171329] shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-purple-500/15"
      style={{
        border: '1px solid color-mix(in srgb, var(--brand) 18%, transparent)',
      }}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-purple-50 dark:bg-purple-950/30">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition" />

        {/* Badges hiện đại */}
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
          {hot && (
            <span className="rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-white shadow-lg tracking-wide">
              🔥 HOT
            </span>
          )}
          {full && (
            <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-white shadow-md">
              FULL
            </span>
          )}
        </div>

        {/* Rating star giả lập vui vẻ */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-2 py-0.5 text-[11px] font-bold text-amber-300">
          <StarIcon className="h-3 w-3 text-amber-400" />
          <span>4.9</span>
        </div>

        <span className="absolute bottom-2.5 right-2.5 rounded-full bg-purple-900/80 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold text-purple-100 border border-purple-400/30">
          {novel.chaptersCount} CH
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
          {genreLabel(guessGenre(novel))}
        </span>
        <h3 className="clamp-2 mt-0.5 text-sm font-extrabold leading-snug tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {novel.author}
          </p>
        )}
      </div>
    </Link>
  );
}

/* =========================================================
   3. DẠ HUYỀN ẢO (da-huyen-ao) — Thẻ Ma Bài Vực Thẳm Neon
   ========================================================= */
export function DaHuyenAoCard({ novel, coverOverride }: NovelCardProps) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;

  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group relative flex flex-col overflow-hidden rounded-2xl bg-[#110c22] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_25px_rgba(168,85,247,0.45)] hover:border-purple-400"
      style={{
        border: '1px solid rgba(139, 92, 246, 0.28)',
      }}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#0a0716]">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-108 group-hover:brightness-110"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        {/* Glow vignette ma thuật */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090714] via-[#090714]/30 to-transparent" />

        <div className="absolute left-2 top-2 rounded-lg bg-purple-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-300 border border-purple-500/40 backdrop-blur-md">
          ✦ Ma Điển
        </div>
        <div className="absolute bottom-2 right-2 rounded-lg bg-black/80 px-2 py-0.5 text-[11px] font-mono text-cyan-300 border border-cyan-500/30">
          ⚡ {readable} CH
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-purple-400">
          {genreLabel(guessGenre(novel))}
        </p>
        <h3
          className="clamp-2 mt-1 text-sm font-semibold leading-snug text-purple-50 group-hover:text-purple-300 transition"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-1 truncate text-xs text-purple-300/60 font-mono">
            {novel.author}
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-purple-400/80 border-t border-purple-900/30">
          <span>{novel.chaptersCount} Hồi</span>
          <span className="text-cyan-400 group-hover:translate-x-1 transition-transform">
            Khai quyển ›
          </span>
        </div>
      </div>
    </Link>
  );
}

/* =========================================================
   4. CỔ PHONG (co-phong) — Trang Thư Tịch Giấy Dó & Triện Đỏ
   ========================================================= */
export function CoPhongCard({ novel, coverOverride }: NovelCardProps) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const full = isCompleted(novel);
  const hot = novel.chaptersCount >= 1000;

  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group relative flex flex-col overflow-hidden rounded-md bg-[#fdfbf7] dark:bg-[#221a12] p-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
      style={{
        border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)',
        boxShadow: '0 2px 8px rgba(60, 40, 20, 0.08)',
      }}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded bg-stone-300 dark:bg-stone-800">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        {/* Dải triện son đỏ góc trên */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {hot && (
            <span className="seal-stamp text-[10px] shadow-sm">
              [ 絕 品 ]
            </span>
          )}
          {full && (
            <span className="seal-stamp text-[10px] shadow-sm !border-amber-600 !text-amber-700 dark:!text-amber-300">
              [ 大 結 局 ]
            </span>
          )}
        </div>
        <span className="absolute bottom-2 right-2 rounded bg-stone-900/80 px-2 py-0.5 text-[11px] font-serif text-amber-100">
          {novel.chaptersCount} hồi
        </span>
      </div>

      <div className="flex flex-1 flex-col pt-2.5 pb-1">
        <p className="text-[11px] font-serif tracking-widest text-red-800 dark:text-red-400">
          【{genreLabel(guessGenre(novel))}】
        </p>
        <h3
          className="clamp-2 mt-0.5 text-sm font-bold leading-snug text-stone-900 dark:text-stone-100 group-hover:text-red-700 transition"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-1 truncate text-xs text-stone-600 dark:text-stone-400 font-serif">
            Tác giả: {novel.author}
          </p>
        )}
      </div>
    </Link>
  );
}

/* =========================================================
   5. TỐI GIẢN (toi-gian) — Swiss Modernist Clean Grid
   ========================================================= */
export function ToiGianCard({ novel, coverOverride }: NovelCardProps) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  const full = isCompleted(novel);

  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group flex flex-col overflow-hidden rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black transition-colors hover:border-black dark:hover:border-white"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover grayscale-[20%] transition group-hover:grayscale-0 group-hover:scale-102"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <div className="absolute left-2 top-2 flex gap-1">
          {full && (
            <span className="bg-black dark:bg-white px-2 py-0.5 text-[9px] font-mono font-bold uppercase text-white dark:text-black">
              FULL
            </span>
          )}
        </div>
        <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-white">
          CH. {readable}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {genreLabel(guessGenre(novel))}
        </p>
        <h3 className="clamp-2 mt-1 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:underline underline-offset-2">
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-1 truncate text-xs text-zinc-500 font-mono">
            {novel.author}
          </p>
        )}
        <div className="mt-auto pt-2 text-[10px] font-mono text-zinc-400 border-t border-zinc-100 dark:border-zinc-900 flex justify-between">
          <span>{novel.sourceName}</span>
          <span>{novel.chaptersCount} Chapters</span>
        </div>
      </div>
    </Link>
  );
}

/* =========================================================
   6. TINH HÀ (tinh-ha) — Card Dọc Snap & Card Ngang Editorial
   ========================================================= */
export function TinhHaVerticalCard({
  novel,
  coverOverride,
  className = 'w-36 shrink-0 snap-start sm:w-44',
}: NovelCardProps & { className?: string }) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;

  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className={`tinh-ha-lift group block ${className} overflow-hidden rounded-2xl bg-[var(--card-bg)] shadow-sm`}
      style={{
        border: '1px solid var(--border, color-mix(in srgb, var(--ink) 12%, transparent))',
      }}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40 group-hover:opacity-20 transition" />
      </div>
      <div className="p-3">
        <h3
          className="clamp-2 text-base font-semibold leading-snug"
          style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-1 truncate text-xs" style={{ color: 'var(--muted)' }}>
            {novel.author}
          </p>
        )}
        <span
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
        >
          <BookOpenIcon className="h-3 w-3" />
          {readable} chương
        </span>
      </div>
    </Link>
  );
}

export function TinhHaRowCard({ novel, coverOverride }: NovelCardProps) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;

  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="tinh-ha-lift group flex gap-4 rounded-2xl bg-[var(--card-bg)] p-3 sm:p-4 shadow-sm"
      style={{
        border: '1px solid var(--border, color-mix(in srgb, var(--ink) 12%, transparent))',
      }}
    >
      <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-xl sm:h-44 sm:w-32 shadow-md">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ color: 'var(--brand)' }}
        >
          {genreLabel(guessGenre(novel))}
        </p>
        <h3
          className="clamp-2 mt-1 text-xl font-bold leading-tight sm:text-2xl"
          style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-0.5 truncate text-sm" style={{ color: 'var(--muted)' }}>
            {novel.author}
          </p>
        )}
        {novel.description && (
          <p className="clamp-2 mt-2 hidden text-sm leading-relaxed sm:block" style={{ color: 'var(--muted)' }}>
            {novel.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-amber-900/10 dark:border-amber-100/10">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>
            <BookOpenIcon className="h-3.5 w-3.5" />
            {readable} chương đọc được / {novel.chaptersCount} chương
          </span>
          <span
            className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold"
            style={{ color: 'var(--brand)' }}
          >
            Đọc tiếp
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* =========================================================
   ROUTER CARD TỰ ĐỘNG THEO 6 BỘ GIAO DIỆN
   ========================================================= */
export default function NovelCard(props: NovelCardProps) {
  const { template } = useTemplate();

  switch (template) {
    case 'truyenc':
      return <TruyencCard {...props} />;
    case 'da-huyen-ao':
      return <DaHuyenAoCard {...props} />;
    case 'co-phong':
      return <CoPhongCard {...props} />;
    case 'toi-gian':
      return <ToiGianCard {...props} />;
    case 'tinh-ha':
      return <TinhHaVerticalCard {...props} className="w-full" />;
    case 'thu-cac':
    default:
      return <ThuCacCard {...props} />;
  }
}

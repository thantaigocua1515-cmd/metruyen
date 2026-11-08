import { Link } from 'react-router-dom';
import type { NovelSummary } from '../lib/novelApi';
import { useTemplate } from '../context/TemplateContext';
import { genreLabel, guessGenre } from '../lib/genres';
import { ArrowRightIcon, BookOpenIcon, FlameIcon, SparklesIcon } from './icons';

interface Props {
  novel: NovelSummary;
  coverOverride?: string | null;
  index?: number;
}

const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2f5e"/><stop offset="1" stop-color="#141021"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><text x="150" y="210" font-size="48" font-family="serif" text-anchor="middle" fill="#d4af37">MÊ TRUYỆN</text></svg>`,
  );

function isCompleted(novel: NovelSummary): boolean {
  return !!novel.status && /complet|full|hoàn thành|done/i.test(novel.status);
}

/* ========================================================================
   1. THU-CAC: Scholarly Book Spine Card (hiệu ứng bìa sách có gáy nổi 3D)
   ======================================================================== */
function ThuCacCard({ novel, coverOverride }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  const genre = genreLabel(guessGenre(novel));
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group flex flex-col rounded-2xl bg-[var(--card-bg)] p-3 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="book-spine relative aspect-[3/4] overflow-hidden rounded-r-lg rounded-l-sm bg-stone-200 dark:bg-stone-800">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <span
          className="absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase shadow"
          style={{
            background: 'color-mix(in srgb, var(--page-bg) 92%, transparent)',
            color: 'var(--brand-strong)',
          }}
        >
          {genre}
        </span>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <h3
          className="clamp-2 font-display text-base font-bold leading-snug transition group-hover:opacity-80 sm:text-lg"
          style={{ color: 'var(--ink)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-0.5 truncate text-xs italic" style={{ color: 'var(--muted)' }}>
            {novel.author}
          </p>
        )}
        <div
          className="mt-auto flex items-center justify-between border-t pt-2.5 text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--brand-strong)' }}
        >
          <span className="inline-flex items-center gap-1 font-semibold">
            <BookOpenIcon className="h-3.5 w-3.5" />
            {readable} chương
          </span>
          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {novel.sourceName}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ========================================================================
   2. TRUYENC: Super-App Vibrant Poster Card (floating badges, gradient overlay)
   ======================================================================== */
function TruyencCard({ novel, coverOverride }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const hot = novel.chaptersCount >= 500;
  const full = isCompleted(novel);
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group relative overflow-hidden rounded-2xl bg-[var(--card-bg)] shadow-sm transition duration-200 hover:-translate-y-1.5 hover:shadow-xl"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-200 dark:bg-stone-800">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
          {hot && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 px-2 py-0.5 text-[10px] font-extrabold text-white shadow">
              <FlameIcon className="h-3 w-3" /> HOT
            </span>
          )}
          {full && (
            <span className="rounded-lg bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white shadow">
              FULL
            </span>
          )}
        </div>
        <div className="absolute inset-x-2.5 bottom-2 flex items-center justify-between text-[11px] font-bold text-white">
          <span className="rounded-md bg-white/20 px-2 py-0.5 backdrop-blur-md">
            {genreLabel(guessGenre(novel))}
          </span>
          <span className="rounded-md bg-black/60 px-2 py-0.5">
            {readable} ch
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3
          className="clamp-2 font-display text-sm font-bold leading-snug transition group-hover:text-[var(--brand)]"
          style={{ color: 'var(--ink)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-1 truncate text-xs" style={{ color: 'var(--muted)' }}>
            {novel.author}
          </p>
        )}
      </div>
    </Link>
  );
}

/* ========================================================================
   3. DA-HUYEN-AO: Arcane Tarot / Grimoire Card (ornate border, realm tier)
   ======================================================================== */
function DaHuyenAoCard({ novel, coverOverride }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  const tier =
    readable >= 1000 ? 'Thần Điển' : readable >= 500 ? 'Tiên Kinh' : 'Linh Quyển';
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="arcane-card animate-fade-up group flex flex-col overflow-hidden rounded-2xl p-2.5"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-purple-500/30">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-108"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080612] via-transparent to-black/30" />
        <span
          className="font-mono-tech absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md"
          style={{
            borderColor: 'rgba(34,211,238,0.45)',
            background: 'rgba(8,6,18,0.75)',
            color: 'var(--accent)',
          }}
        >
          <SparklesIcon className="h-3 w-3" /> {tier}
        </span>
        <span
          className="font-mono-tech absolute bottom-2 right-2 rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: 'rgba(168,85,247,0.85)', color: '#fff' }}
        >
          {readable} CHƯƠNG
        </span>
      </div>
      <div className="mt-2.5 flex flex-1 flex-col px-1 pb-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--accent)' }}>
          {genreLabel(guessGenre(novel))}
        </p>
        <h3
          className="clamp-2 font-display mt-1 text-sm font-bold tracking-wide sm:text-base"
          style={{ color: 'var(--ink)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-auto pt-2 truncate text-xs" style={{ color: 'var(--muted)' }}>
            Đạo hiệu: {novel.author}
          </p>
        )}
      </div>
    </Link>
  );
}

/* ========================================================================
   4. CO-PHONG: Oriental Rice-Paper Plaque & Vermilion Seal
   ======================================================================== */
function CoPhongCard({ novel, coverOverride }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="cophong-frame animate-fade-up group flex flex-col p-3 transition duration-200 hover:-translate-y-1"
    >
      <div
        className="relative aspect-[3/4] overflow-hidden border"
        style={{ borderColor: 'var(--border)' }}
      >
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <span className="cophong-seal absolute right-2 top-2 px-1.5 py-0.5 text-[10px]">
          {genreLabel(guessGenre(novel))}
        </span>
      </div>
      <div className="mt-3 flex flex-1 flex-col text-center">
        <h3
          className="clamp-2 font-display text-base font-bold leading-snug"
          style={{ color: 'var(--ink)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-1 truncate text-xs" style={{ color: 'var(--muted)' }}>
            Tác giả: {novel.author}
          </p>
        )}
        <div
          className="mt-auto pt-2 text-xs font-semibold"
          style={{ color: 'var(--brand)' }}
        >
          — Quyển {readable} chương —
        </div>
      </div>
    </Link>
  );
}

/* ========================================================================
   5. TOI-GIAN: Swiss Modernism 2.0 Grid Cell (0px radius, monospace index)
   ======================================================================== */
function ToiGianCard({ novel, coverOverride, index }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  const idxLabel = index !== undefined ? String(index + 1).padStart(2, '0') : ' ARCHIVE ';
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="swiss-cell group flex flex-col justify-between border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
    >
      <div>
        <div className="mb-3 flex items-center justify-between text-[11px] font-bold">
          <span className="font-mono-tech" style={{ color: 'var(--brand)' }}>
            #{idxLabel}
          </span>
          <span className="font-mono-tech uppercase" style={{ color: 'var(--muted)' }}>
            {genreLabel(guessGenre(novel))}
          </span>
        </div>
        <div
          className="aspect-[3/4] overflow-hidden border bg-zinc-100 dark:bg-zinc-900"
          style={{ borderColor: 'var(--border)' }}
        >
          <img
            src={cover}
            alt={novel.title}
            loading="lazy"
            className="h-full w-full object-cover grayscale-[20%] transition duration-200 group-hover:grayscale-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER;
            }}
          />
        </div>
        <h3
          className="clamp-2 font-display mt-3 text-base font-extrabold tracking-tight uppercase"
          style={{ color: 'var(--ink)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="font-mono-tech mt-1 truncate text-xs" style={{ color: 'var(--muted)' }}>
            BY {novel.author.toUpperCase()}
          </p>
        )}
      </div>
      <div
        className="font-mono-tech mt-4 flex items-center justify-between border-t pt-2.5 text-xs font-bold"
        style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
      >
        <span>{readable} CH.</span>
        <span style={{ color: 'var(--brand)' }}>READ →</span>
      </div>
    </Link>
  );
}

/* ========================================================================
   6. TINH-HA: Cinematic Vertical & Editorial Row Cards
   ======================================================================== */
export function TinhHaVerticalCard({
  novel,
  coverOverride,
  className = 'w-40 shrink-0 snap-start sm:w-48',
}: Props & { className?: string }) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className={`tinh-ha-lift group block ${className} overflow-hidden rounded-xl bg-[var(--card-bg)]`}
      style={{ border: '1px solid var(--border)' }}
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
      </div>
      <div className="p-3">
        <h3
          className="clamp-2 font-display text-base font-semibold leading-snug"
          style={{ color: 'var(--ink)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-1 truncate text-xs" style={{ color: 'var(--muted)' }}>
            {novel.author}
          </p>
        )}
        <span
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
        >
          <BookOpenIcon className="h-3 w-3" />
          {readable} chương
        </span>
      </div>
    </Link>
  );
}

export function TinhHaRowCard({ novel, coverOverride }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="tinh-ha-lift group flex gap-4 rounded-2xl bg-[var(--card-bg)] p-3.5 sm:p-4"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-xl sm:h-40 sm:w-28">
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
          className="clamp-2 font-display mt-1 text-xl font-semibold leading-tight sm:text-2xl"
          style={{ color: 'var(--ink)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-0.5 truncate text-xs sm:text-sm" style={{ color: 'var(--muted)' }}>
            {novel.author}
          </p>
        )}
        {novel.description && (
          <p className="clamp-2 mt-2 hidden text-sm leading-relaxed sm:block" style={{ color: 'var(--muted)' }}>
            {novel.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>
            <BookOpenIcon className="h-3.5 w-3.5" />
            {readable} / {novel.chaptersCount} chương
          </span>
          <span
            className="inline-flex items-center gap-1 text-sm font-semibold"
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

export default function NovelCard(props: Props) {
  const { template } = useTemplate();
  if (template === 'truyenc') return <TruyencCard {...props} />;
  if (template === 'da-huyen-ao') return <DaHuyenAoCard {...props} />;
  if (template === 'co-phong') return <CoPhongCard {...props} />;
  if (template === 'toi-gian') return <ToiGianCard {...props} />;
  if (template === 'tinh-ha') return <TinhHaVerticalCard {...props} className="w-full" />;
  return <ThuCacCard {...props} />;
}

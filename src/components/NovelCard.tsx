import { Link } from 'react-router-dom';
import type { NovelSummary } from '../lib/novelApi';
import { useTemplate } from '../context/TemplateContext';
import { genreLabel, guessGenre } from '../lib/genres';
import { ArrowRightIcon, BookOpenIcon } from './icons';

interface Props {
  novel: NovelSummary;
  coverOverride?: string | null;
}

const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2f5e"/><stop offset="1" stop-color="#141021"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><text x="150" y="210" font-size="64" text-anchor="middle" fill="#d4af37">📚</text></svg>`,
  );

/** Badge "Full" chỉ khi API báo trạng thái hoàn thành thật (không bịa). */
function isCompleted(novel: NovelSummary): boolean {
  return !!novel.status && /complet|full|hoàn thành|done/i.test(novel.status);
}

function TruyencCard({ novel, coverOverride }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const hot = novel.chaptersCount >= 1000;
  const full = isCompleted(novel);
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group overflow-hidden rounded-2xl bg-[var(--card-bg)] shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
      style={{ border: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-200 dark:bg-stone-800">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {hot && (
            <span className="rounded-lg bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
              🔥 HOT
            </span>
          )}
          {full && (
            <span className="rounded-lg bg-green-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
              Full
            </span>
          )}
        </div>
        <span className="absolute bottom-2 right-2 rounded-lg bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
          {novel.chaptersCount} ch
        </span>
      </div>
      <div className="p-2.5">
        <h3 className="clamp-2 text-sm font-bold leading-snug" style={{ color: 'var(--ink)' }}>
          {novel.title}
        </h3>
        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--muted)' }}>
          {genreLabel(guessGenre(novel))}
        </p>
        {novel.author && (
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--muted)' }}>
            {novel.author}
          </p>
        )}
      </div>
    </Link>
  );
}

function DefaultCard({ novel, coverOverride }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group overflow-hidden rounded-xl bg-[var(--card-bg)] shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
      style={{ border: '1px solid color-mix(in srgb, var(--ink) 12%, transparent)' }}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-200 dark:bg-stone-800">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-amber-200">
          {novel.sourceName}
        </span>
      </div>
      <div className="p-2.5">
        <h3
          className="clamp-2 text-sm font-bold leading-snug group-hover:opacity-80"
          style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
        >
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--muted)' }}>
            {novel.author}
          </p>
        )}
        <p className="mt-1 text-xs font-medium" style={{ color: 'var(--brand)' }}>
          {readable} chương đọc được / {novel.chaptersCount} chương
        </p>
      </div>
    </Link>
  );
}

export default function NovelCard(props: Props) {
  const { template } = useTemplate();
  if (template === 'truyenc') return <TruyencCard {...props} />;
  // tinh-ha: bản full-width cho lưới (Search/Genres), bản snap-row dùng TinhHaVerticalCard riêng ở Home
  if (template === 'tinh-ha') return <TinhHaVerticalCard {...props} className="w-full" />;
  return <DefaultCard {...props} />;
}

/** Card dọc cho template tinh-ha (dùng trong hàng cuộn ngang "Mới cập nhật"). */
export function TinhHaVerticalCard({
  novel,
  coverOverride,
  className = 'w-36 shrink-0 snap-start sm:w-44',
}: Props & { className?: string }) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className={`tinh-ha-lift group block ${className} overflow-hidden rounded-xl bg-[var(--card-bg)]`}
      style={{ border: '1px solid var(--border, color-mix(in srgb, var(--ink) 12%, transparent))' }}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
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

/** Card ngang cho template tinh-ha (dùng trong mục "Toàn bộ truyện"). */
export function TinhHaRowCard({ novel, coverOverride }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="tinh-ha-lift group flex gap-4 rounded-xl bg-[var(--card-bg)] p-3 sm:p-4"
      style={{ border: '1px solid var(--border, color-mix(in srgb, var(--ink) 12%, transparent))' }}
    >
      <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-lg sm:h-40 sm:w-28">
        <img
          src={cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--brand)' }}
        >
          {genreLabel(guessGenre(novel))}
        </p>
        <h3
          className="clamp-2 mt-1 text-xl font-semibold leading-tight sm:text-2xl"
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
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>
            <BookOpenIcon className="h-3.5 w-3.5" />
            {readable} chương đọc được / {novel.chaptersCount} chương
          </span>
          <span
            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold"
            style={{ color: 'var(--brand)' }}
          >
            Đọc tiếp
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

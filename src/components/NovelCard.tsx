import { Link } from 'react-router-dom';
import type { NovelSummary } from '../lib/novelApi';
import { useTemplate } from '../context/TemplateContext';
import { genreLabel, guessGenre } from '../lib/genres';

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
  return <DefaultCard {...props} />;
}

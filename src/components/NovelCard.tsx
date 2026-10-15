import { Link } from 'react-router-dom';
import type { NovelSummary } from '../lib/novelApi';

interface Props {
  novel: NovelSummary;
  coverOverride?: string | null;
}

const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2f5e"/><stop offset="1" stop-color="#141021"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><text x="150" y="210" font-size="64" text-anchor="middle" fill="#d4af37">📚</text></svg>`,
  );

export default function NovelCard({ novel, coverOverride }: Props) {
  const cover = coverOverride || novel.coverUrl || PLACEHOLDER;
  const readable = novel.translatedChaptersCount || novel.chaptersCount;
  return (
    <Link
      to={`/novel/${novel.sourceId}/${encodeURIComponent(novel.id)}`}
      className="animate-fade-up group overflow-hidden rounded-xl border border-amber-900/15 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-amber-100/10 dark:bg-stone-900"
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
        <h3 className="clamp-2 font-display text-sm font-bold leading-snug text-stone-900 group-hover:text-amber-800 dark:text-stone-100 dark:group-hover:text-amber-300">
          {novel.title}
        </h3>
        {novel.author && (
          <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">{novel.author}</p>
        )}
        <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
          {readable} chương đọc được / {novel.chaptersCount} chương
        </p>
      </div>
    </Link>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';
import { BookmarkIcon, BookOpenIcon, XIcon } from '../components/icons';

interface ShelfRow {
  source_id: string;
  novel_id: string;
  novel_title: string | null;
  novel_cover: string | null;
  last_chapter: number;
  updated_at: string;
}

export default function Bookshelf() {
  const { user } = useAuth();
  const { template } = useTemplate();
  const [rows, setRows] = useState<ShelfRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (userId: string) => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('bookshelf')
      .select('source_id,novel_id,novel_title,novel_cover,last_chapter,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    setRows((data ?? []) as ShelfRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) void load(user.id);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const remove = async (r: ShelfRow) => {
    if (!user || !window.confirm(`Bỏ "${r.novel_title}" khỏi tủ truyện?`)) return;
    const supabase = getSupabase();
    await supabase
      .from('bookshelf')
      .delete()
      .eq('user_id', user.id)
      .eq('source_id', r.source_id)
      .eq('novel_id', r.novel_id);
    setRows((prev) =>
      prev.filter((x) => !(x.source_id === r.source_id && x.novel_id === r.novel_id)),
    );
  };

  if (!user) {
    return (
      <p className="py-20 text-center" style={{ color: 'var(--muted)' }}>
        Hãy{' '}
        <Link to="/auth" className="font-bold underline" style={{ color: 'var(--brand)' }}>
          đăng nhập
        </Link>{' '}
        để xem tủ truyện.
      </p>
    );
  }

  const isSwiss = template === 'toi-gian';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
          >
            <BookmarkIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
              Tủ Truyện Của Bạn
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Lưu tiến độ đọc tự động trên mọi thiết bị ({rows.length} tác phẩm)
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center" style={{ color: 'var(--muted)' }}>
          Đang tải tủ truyện...
        </p>
      ) : rows.length === 0 ? (
        <div
          className="my-12 rounded-3xl border p-10 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
        >
          <p className="font-display text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Tủ truyện còn trống
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Hãy chọn một bộ truyện yêu thích và bấm "Lưu vào tủ truyện" để theo dõi.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex h-10 items-center rounded-full px-6 text-sm font-bold text-white"
            style={{ background: 'var(--brand)' }}
          >
            Khám phá truyện ngay
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.map((r) => (
            <div
              key={`${r.source_id}:${r.novel_id}`}
              className={`group relative flex flex-col overflow-hidden border bg-[var(--card-bg)] p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                isSwiss ? '' : 'rounded-2xl'
              }`}
              style={{ borderColor: 'var(--border)' }}
            >
              <Link to={`/novel/${r.source_id}/${encodeURIComponent(r.novel_id)}`} className="block">
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-stone-200 dark:bg-stone-800">
                  {r.novel_cover && (
                    <img
                      src={r.novel_cover}
                      alt={r.novel_title ?? ''}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <h3
                  className="clamp-2 font-display mt-3 text-base font-bold leading-snug"
                  style={{ color: 'var(--ink)' }}
                >
                  {r.novel_title ?? r.novel_id}
                </h3>
              </Link>

              <div className="mt-auto pt-3">
                <Link
                  to={`/read/${r.source_id}/${encodeURIComponent(r.novel_id)}/${r.last_chapter}`}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition hover:opacity-90"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
                >
                  <BookOpenIcon className="h-3.5 w-3.5" />
                  Đọc tiếp Ch. {r.last_chapter}
                </Link>
              </div>

              <button
                onClick={() => void remove(r)}
                title="Bỏ khỏi tủ"
                aria-label="Bỏ khỏi tủ"
                className="absolute right-4 top-4 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-red-600"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

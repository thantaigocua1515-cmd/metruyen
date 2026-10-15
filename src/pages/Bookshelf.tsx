import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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
      <p className="py-16 text-center text-stone-500 dark:text-stone-400">
        Hãy <Link to="/auth" className="text-amber-700 underline dark:text-amber-300">đăng nhập</Link> để
        xem tủ truyện.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-center text-2xl font-bold text-amber-950 dark:text-amber-100">
        📚 Tủ Truyện Của Bạn
      </h1>

      {loading ? (
        <p className="py-10 text-center text-stone-500">Đang tải...</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center italic text-stone-500 dark:text-stone-400">
          Tủ truyện còn trống. Hãy tìm một bộ truyện hay và bấm "Lưu tủ truyện"!
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <div
              key={`${r.source_id}:${r.novel_id}`}
              className="relative overflow-hidden rounded-xl border border-amber-900/15 bg-white shadow-sm dark:border-amber-100/10 dark:bg-stone-900"
            >
              <Link to={`/novel/${r.source_id}/${encodeURIComponent(r.novel_id)}`}>
                <div className="aspect-[3/4] bg-stone-200 dark:bg-stone-800">
                  {r.novel_cover && (
                    <img
                      src={r.novel_cover}
                      alt={r.novel_title ?? ''}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="clamp-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                    {r.novel_title ?? r.novel_id}
                  </h3>
                  <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                    Đang đọc: chương {r.last_chapter}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => void remove(r)}
                title="Bỏ khỏi tủ"
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { fetchNovelDetail } from '../lib/novelApi';
import type { ApiSourceRow, NovelDetail as NovelDetailType } from '../lib/novelApi';
import { getSyncedNovelChapterList } from '../lib/library';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 80;

export default function NovelDetail() {
  const { sourceId, novelId } = useParams<{ sourceId: string; novelId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<NovelDetailType | null>(null);
  const [overrideCover, setOverrideCover] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [continueChapter, setContinueChapter] = useState(1);
  const [inShelf, setInShelf] = useState(false);
  const [showCount, setShowCount] = useState(PAGE_SIZE);
  const [jump, setJump] = useState('');
  const [fromDb, setFromDb] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!sourceId || !novelId) return;
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabase();
        const { data: sRow, error: sErr } = await supabase
          .from('api_sources')
          .select('id,name,openapi_url,base_url,is_active')
          .eq('id', sourceId)
          .single();
        if (sErr || !sRow) throw new Error('Không tìm thấy nguồn truyện.');
        const src = sRow as ApiSourceRow;
        const d = await fetchNovelDetail(src, novelId);
        // Ưu tiên mục lục THẬT từ database đã đồng bộ (tiêu đề chương thật,
        // chính xác hơn danh sách ảo sinh từ số lượng)
        let db = false;
        try {
          const syncedList = await getSyncedNovelChapterList(`${sourceId}:${novelId}`);
          if (syncedList.length > 0) {
            d.chapters = syncedList;
            d.chaptersVirtual = false;
            db = true;
          }
        } catch {
          /* bảng chưa có / lỗi DB → dùng mục lục API như cũ */
        }
        const { data: ov } = await supabase
          .from('thumbnail_overrides')
          .select('thumbnail_url')
          .eq('source_id', sourceId)
          .eq('novel_id', novelId)
          .maybeSingle();
        let cont = 1;
        let shelf = false;
        if (user) {
          const { data: prog } = await supabase
            .from('reading_progress')
            .select('chapter')
            .eq('user_id', user.id)
            .eq('source_id', sourceId)
            .eq('novel_id', novelId)
            .maybeSingle();
          if (prog) cont = (prog as { chapter: number }).chapter;
          const { data: sh } = await supabase
            .from('bookshelf')
            .select('novel_id')
            .eq('user_id', user.id)
            .eq('source_id', sourceId)
            .eq('novel_id', novelId)
            .maybeSingle();
          shelf = Boolean(sh);
        }
        if (alive) {
          setDetail(d);
          setFromDb(db);
          setOverrideCover((ov as { thumbnail_url: string } | null)?.thumbnail_url ?? null);
          setContinueChapter(cont);
          setInShelf(shelf);
          setShowCount(PAGE_SIZE);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Tải chi tiết thất bại.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sourceId, novelId, user?.id]);

  const toggleShelf = async () => {
    if (!user || !detail || !sourceId || !novelId) return;
    const supabase = getSupabase();
    try {
      if (inShelf) {
        await supabase
          .from('bookshelf')
          .delete()
          .eq('user_id', user.id)
          .eq('source_id', sourceId)
          .eq('novel_id', novelId);
        setInShelf(false);
      } else {
        await supabase.from('bookshelf').upsert(
          {
            user_id: user.id,
            source_id: sourceId,
            novel_id: novelId,
            novel_title: detail.title,
            novel_cover: overrideCover || detail.coverUrl,
            last_chapter: continueChapter,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,source_id,novel_id' },
        );
        setInShelf(true);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Thao tác tủ truyện thất bại.');
    }
  };

  if (loading) {
    return <p className="py-16 text-center text-stone-500 dark:text-stone-400">Đang mở thư tịch...</p>;
  }
  if (error || !detail) {
    return (
      <p className="py-16 text-center text-red-600 dark:text-red-400">{error ?? 'Không tìm thấy truyện.'}</p>
    );
  }

  const cover = overrideCover || detail.coverUrl;
  const readable = detail.translatedChaptersCount || detail.chaptersCount;
  const visibleChapters = detail.chapters.slice(0, showCount);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        {cover && (
          <img
            src={cover}
            alt={detail.title}
            className="mx-auto w-48 shrink-0 rounded-xl border border-amber-900/20 object-cover shadow-lg sm:mx-0 sm:w-56 dark:border-amber-100/15"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-amber-950 sm:text-3xl dark:text-amber-100">
            {detail.title}
          </h1>
          {detail.author && (
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Tác giả: {detail.author}</p>
          )}
          <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-300">
            {readable} chương đọc được / {detail.chaptersCount} chương · Nguồn: {detail.sourceName}
          </p>
          {detail.description && (
            <p className="clamp-3 mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              {detail.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => navigate(`/read/${sourceId}/${encodeURIComponent(detail.id)}/${continueChapter}`)}
              className="rounded-full bg-amber-700 px-6 py-2 font-semibold text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              📖 {continueChapter > 1 ? `Đọc tiếp chương ${continueChapter}` : 'Bắt đầu đọc'}
            </button>
            {user && (
              <button
                onClick={() => void toggleShelf()}
                className={`rounded-full px-6 py-2 font-semibold ${
                  inShelf
                    ? 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200'
                    : 'border border-amber-700 text-amber-800 dark:border-amber-500 dark:text-amber-300'
                }`}
              >
                {inShelf ? '✓ Đã lưu tủ truyện' : '＋ Lưu tủ truyện'}
              </button>
            )}
            {detail.links.epub && (
              <a
                href={detail.links.epub}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-stone-300 px-6 py-2 font-semibold text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                ⬇ EPUB
              </a>
            )}
          </div>
        </div>
      </div>

      <h2 className="font-display mt-8 text-xl font-bold text-amber-950 dark:text-amber-100">
        📜 Mục lục ({detail.chapters.length} chương)
        {fromDb && (
          <span className="ml-2 align-middle text-xs font-normal text-stone-500 dark:text-stone-400">
            📦 từ database đã đồng bộ
          </span>
        )}
      </h2>
      <div className="mt-2 flex gap-2">
        <input
          value={jump}
          onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
          placeholder="Nhảy tới chương số..."
          inputMode="numeric"
          className="w-48 rounded-full border border-amber-900/20 bg-white px-4 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-amber-100/15 dark:bg-stone-900 dark:text-stone-100"
        />
        <button
          onClick={() => {
            const n = parseInt(jump, 10);
            if (n > 0) navigate(`/read/${sourceId}/${encodeURIComponent(detail.id)}/${n}`);
          }}
          className="rounded-full bg-stone-800 px-4 py-1.5 text-sm font-semibold text-white dark:bg-stone-700"
        >
          Đi
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {visibleChapters.map((c) => (
          <Link
            key={c.number}
            to={`/read/${sourceId}/${encodeURIComponent(detail.id)}/${c.number}`}
            className={`truncate rounded-lg border px-3 py-2 text-sm transition hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-stone-800 ${
              c.number === continueChapter
                ? 'border-amber-500 bg-amber-50 font-semibold text-amber-900 dark:bg-stone-800 dark:text-amber-200'
                : 'border-amber-900/15 text-stone-700 dark:border-amber-100/10 dark:text-stone-300'
            }`}
          >
            {c.title}
          </Link>
        ))}
      </div>
      {showCount < detail.chapters.length && (
        <button
          onClick={() => setShowCount((c) => c + PAGE_SIZE * 2)}
          className="mt-4 w-full rounded-xl border border-amber-900/20 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-100/15 dark:text-amber-300 dark:hover:bg-stone-800"
        >
          Xem thêm chương ({detail.chapters.length - showCount} còn lại)
        </button>
      )}
    </div>
  );
}

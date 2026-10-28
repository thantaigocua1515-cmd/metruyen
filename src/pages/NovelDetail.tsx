import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { fetchNovelDetail } from '../lib/novelApi';
import type { ApiSourceRow, NovelDetail as NovelDetailType } from '../lib/novelApi';
import { getSyncedNovel, getSyncedNovelChapterList } from '../lib/library';
import { useAuth } from '../context/AuthContext';
import { syncStateStats } from '../lib/gamification';

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
        let d: NovelDetailType;
        // Ưu tiên mục lục THẬT từ database đã đồng bộ (tiêu đề chương thật,
        // chính xác hơn danh sách ảo sinh từ số lượng)
        let db = false;
        if (sourceId === 'manual') {
          // Truyện nhập tay: đọc trực tiếp từ DB, không qua api_sources
          const row = await getSyncedNovel(`${sourceId}:${novelId}`);
          if (!row) throw new Error('Không tìm thấy truyện.');
          const syncedList = await getSyncedNovelChapterList(row.id).catch(() => []);
          db = syncedList.length > 0;
          d = {
            sourceId: 'manual',
            sourceName: '📝 Nhập tay',
            id: row.api_id,
            title: row.title,
            author: row.author,
            description: row.description,
            coverUrl: row.cover_url,
            chaptersCount: row.chapters_count,
            translatedChaptersCount: row.translated_count,
            status: row.status,
            links: {},
            chapters: syncedList,
            chaptersVirtual: false,
          };
        } else {
          const { data: sRow, error: sErr } = await supabase
            .from('api_sources')
            .select('id,name,openapi_url,base_url,is_active')
            .eq('id', sourceId)
            .single();
          if (sErr || !sRow) throw new Error('Không tìm thấy nguồn truyện.');
          const src = sRow as ApiSourceRow;
          d = await fetchNovelDetail(src, novelId);
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
      void syncStateStats(user.id);
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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        {cover && (
          <img
            src={cover}
            alt={detail.title}
            className="mx-auto w-48 shrink-0 rounded-2xl border object-cover shadow-xl sm:mx-0 sm:w-56"
            style={{
              borderColor: 'color-mix(in srgb, var(--brand) 25%, transparent)',
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-bold sm:text-3xl leading-snug"
            style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
          >
            {detail.title}
          </h1>
          {detail.author && (
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              Tác giả: {detail.author}
            </p>
          )}
          <p className="mt-1.5 text-sm font-semibold" style={{ color: 'var(--brand)' }}>
            {readable} chương đọc được / {detail.chaptersCount} chương · Nguồn: {detail.sourceName}
          </p>
          {detail.description && (
            <p className="clamp-3 mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              {detail.description}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              onClick={() => navigate(`/read/${sourceId}/${encodeURIComponent(detail.id)}/${continueChapter}`)}
              className="rounded-full px-7 py-2.5 font-bold text-white shadow-md transition hover:opacity-95"
              style={{ background: 'var(--brand)' }}
            >
              📖 {continueChapter > 1 ? `Đọc tiếp chương ${continueChapter}` : 'Bắt đầu đọc'}
            </button>
            {user && (
              <button
                onClick={() => void toggleShelf()}
                className="rounded-full px-6 py-2.5 font-semibold transition border"
                style={
                  inShelf
                    ? { background: 'var(--brand-soft)', color: 'var(--brand-strong)', borderColor: 'var(--brand)' }
                    : { background: 'var(--card-bg)', color: 'var(--ink)', borderColor: 'color-mix(in srgb, var(--ink) 20%, transparent)' }
                }
              >
                {inShelf ? '✓ Đã lưu tủ truyện' : '＋ Lưu tủ truyện'}
              </button>
            )}
            {detail.links.epub && (
              <a
                href={detail.links.epub}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border px-6 py-2.5 font-semibold transition hover:opacity-80"
                style={{
                  background: 'var(--card-bg)',
                  borderColor: 'color-mix(in srgb, var(--ink) 20%, transparent)',
                  color: 'var(--ink)',
                }}
              >
                ⬇ EPUB
              </a>
            )}
          </div>
        </div>
      </div>

      <h2
        className="mt-10 text-xl font-bold"
        style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
      >
        📜 Mục lục ({detail.chapters.length} chương)
        {fromDb && (
          <span className="ml-2 align-middle text-xs font-normal" style={{ color: 'var(--muted)' }}>
            📦 từ database đã đồng bộ
          </span>
        )}
      </h2>
      <div className="mt-3 flex gap-2">
        <input
          value={jump}
          onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
          placeholder="Nhảy tới chương số..."
          inputMode="numeric"
          className="w-48 rounded-full border bg-[var(--card-bg)] px-4 py-2 text-sm outline-none transition focus:border-[var(--brand)]"
          style={{ borderColor: 'color-mix(in srgb, var(--ink) 20%, transparent)', color: 'var(--ink)' }}
        />
        <button
          onClick={() => {
            const n = parseInt(jump, 10);
            if (n > 0) navigate(`/read/${sourceId}/${encodeURIComponent(detail.id)}/${n}`);
          }}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ background: 'var(--brand)' }}
        >
          Đi
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleChapters.map((c) => (
          <Link
            key={c.number}
            to={`/read/${sourceId}/${encodeURIComponent(detail.id)}/${c.number}`}
            className="truncate rounded-xl border px-3.5 py-2.5 text-sm transition"
            style={
              c.number === continueChapter
                ? {
                    background: 'var(--brand-soft)',
                    color: 'var(--brand-strong)',
                    borderColor: 'var(--brand)',
                    fontWeight: 700,
                  }
                : {
                    background: 'var(--card-bg)',
                    color: 'var(--ink)',
                    borderColor: 'color-mix(in srgb, var(--ink) 12%, transparent)',
                  }
            }
          >
            {c.title}
          </Link>
        ))}
      </div>
      {showCount < detail.chapters.length && (
        <button
          onClick={() => setShowCount((c) => c + PAGE_SIZE * 2)}
          className="mt-6 w-full rounded-2xl border py-3 text-sm font-semibold transition hover:opacity-85"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'color-mix(in srgb, var(--brand) 30%, transparent)',
            color: 'var(--brand)',
          }}
        >
          Xem thêm chương ({detail.chapters.length - showCount} còn lại)
        </button>
      )}
    </div>
  );
}

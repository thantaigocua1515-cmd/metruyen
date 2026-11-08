import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { fetchNovelDetail } from '../lib/novelApi';
import type { ApiSourceRow, NovelDetail as NovelDetailType } from '../lib/novelApi';
import { getSyncedNovel, getSyncedNovelChapterList } from '../lib/library';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';
import { syncStateStats } from '../lib/gamification';
import { genreLabel, guessGenre } from '../lib/genres';
import {
  ArrowLeftIcon,
  BookmarkIcon,
  BookOpenIcon,
  CheckIcon,
  DownloadIcon,
  PlusIcon,
  ScrollIcon,
} from '../components/icons';

const PAGE_SIZE = 90;

export default function NovelDetail() {
  const { sourceId, novelId } = useParams<{ sourceId: string; novelId: string }>();
  const { user } = useAuth();
  const { template } = useTemplate();
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
        let db = false;
        if (sourceId === 'manual') {
          const row = await getSyncedNovel(`${sourceId}:${novelId}`);
          if (!row) throw new Error('Không tìm thấy truyện.');
          const syncedList = await getSyncedNovelChapterList(row.id).catch(() => []);
          db = syncedList.length > 0;
          d = {
            sourceId: 'manual',
            sourceName: 'Nhập tay',
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
            /* fallback API */
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
    return (
      <div className="py-24 text-center" style={{ color: 'var(--muted)' }}>
        <div
          className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: 'var(--brand)' }}
        />
        <p className="text-sm font-medium">Đang mở thư tịch...</p>
      </div>
    );
  }
  if (error || !detail) {
    return (
      <p className="py-20 text-center text-red-600 dark:text-red-400">
        {error ?? 'Không tìm thấy truyện.'}
      </p>
    );
  }

  const cover = overrideCover || detail.coverUrl;
  const readable = detail.translatedChaptersCount || detail.chaptersCount;
  const visibleChapters = detail.chapters.slice(0, showCount);
  const genre = genreLabel(guessGenre(detail));

  const isSwiss = template === 'toi-gian';
  const isCoPhong = template === 'co-phong';
  const isArcane = template === 'da-huyen-ao';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-75"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Quay lại danh mục
        </Link>
      </div>

      {/* HERO CARD */}
      <div
        className={`relative overflow-hidden p-5 sm:p-8 ${
          isSwiss
            ? 'border'
            : isCoPhong
              ? 'cophong-frame'
              : isArcane
                ? 'arcane-card rounded-3xl'
                : 'rounded-3xl border shadow-sm'
        }`}
        style={{
          borderColor: 'var(--border)',
          background: isArcane ? undefined : 'var(--card-bg)',
        }}
      >
        {/* Blurred backdrop cho Tinh Hà & TruyenC */}
        {(template === 'tinh-ha' || template === 'truyenc') && cover && (
          <div className="pointer-events-none absolute inset-0 opacity-15 blur-2xl" aria-hidden="true">
            <img src={cover} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          {cover && (
            <div
              className={`mx-auto w-44 shrink-0 overflow-hidden md:mx-0 md:w-56 ${
                template === 'thu-cac'
                  ? 'book-spine rounded-r-xl rounded-l-sm'
                  : isSwiss
                    ? 'border'
                    : isCoPhong
                      ? 'border-2 p-1.5'
                      : 'rounded-2xl shadow-xl'
              }`}
              style={{ borderColor: 'var(--border)' }}
            >
              <img
                src={cover}
                alt={detail.title}
                className="aspect-[3/4] w-full object-cover"
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1 text-xs font-bold ${
                  isSwiss
                    ? 'font-mono-tech border uppercase'
                    : isCoPhong
                      ? 'cophong-seal'
                      : 'rounded-full'
                }`}
                style={
                  isCoPhong
                    ? undefined
                    : {
                        background: 'var(--brand-soft)',
                        color: 'var(--brand-strong)',
                        borderColor: 'var(--border)',
                      }
                }
              >
                {genre}
              </span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                Nguồn: <strong>{detail.sourceName}</strong>
              </span>
              {fromDb && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'var(--surface-alt)', color: 'var(--muted)' }}
                >
                  Đã đồng bộ máy chủ
                </span>
              )}
            </div>

            <h1
              className={`font-display mt-3 text-2xl font-bold leading-tight sm:text-4xl ${
                isSwiss ? 'uppercase tracking-tight' : ''
              }`}
              style={{ color: 'var(--ink)' }}
            >
              {detail.title}
            </h1>

            {detail.author && (
              <p className="mt-1.5 text-sm font-medium" style={{ color: 'var(--muted)' }}>
                Tác giả: <span style={{ color: 'var(--ink)' }}>{detail.author}</span>
              </p>
            )}

            {/* Stats Row */}
            <div
              className="mt-4 inline-flex flex-wrap items-center gap-4 rounded-2xl px-4 py-2.5 text-xs sm:text-sm"
              style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)' }}
            >
              <div>
                <span style={{ color: 'var(--muted)' }}>Số chương đọc được: </span>
                <strong style={{ color: 'var(--brand)' }}>{readable}</strong>
                <span style={{ color: 'var(--muted)' }}> / {detail.chaptersCount}</span>
              </div>
              {continueChapter > 1 && (
                <>
                  <span>•</span>
                  <div>
                    <span style={{ color: 'var(--muted)' }}>Đang đọc: </span>
                    <strong style={{ color: 'var(--ink)' }}>Chương {continueChapter}</strong>
                  </div>
                </>
              )}
            </div>

            {detail.description && (
              <p
                className="mt-4 whitespace-pre-line text-sm leading-relaxed sm:text-[15px]"
                style={{ color: 'var(--muted)' }}
              >
                {detail.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() =>
                  navigate(`/read/${sourceId}/${encodeURIComponent(detail.id)}/${continueChapter}`)
                }
                className={`inline-flex h-11 cursor-pointer items-center gap-2 px-6 text-sm font-bold text-white shadow transition hover:opacity-90 ${
                  isSwiss ? '' : 'rounded-full'
                }`}
                style={{ background: 'var(--brand)' }}
              >
                <BookOpenIcon className="h-4 w-4" />
                {continueChapter > 1 ? `Đọc tiếp chương ${continueChapter}` : 'Bắt đầu đọc'}
              </button>

              {user && (
                <button
                  onClick={() => void toggleShelf()}
                  className={`inline-flex h-11 cursor-pointer items-center gap-2 border px-5 text-sm font-semibold transition hover:opacity-85 ${
                    isSwiss ? '' : 'rounded-full'
                  }`}
                  style={
                    inShelf
                      ? {
                          background: 'var(--brand-soft)',
                          color: 'var(--brand-strong)',
                          borderColor: 'var(--brand)',
                        }
                      : {
                          background: 'var(--card-bg)',
                          color: 'var(--ink)',
                          borderColor: 'var(--border)',
                        }
                  }
                >
                  {inShelf ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                  {inShelf ? 'Đã lưu tủ truyện' : 'Lưu vào tủ truyện'}
                </button>
              )}

              {detail.links.epub && (
                <a
                  href={detail.links.epub}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex h-11 items-center gap-2 border px-5 text-sm font-semibold transition hover:opacity-80 ${
                    isSwiss ? '' : 'rounded-full'
                  }`}
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--muted)',
                    background: 'var(--surface-alt)',
                  }}
                >
                  <DownloadIcon className="h-4 w-4" />
                  Tải EPUB
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CHAPTER INDEX */}
      <div className="mt-10">
        <div
          className="flex flex-wrap items-center justify-between gap-4 border-b pb-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
            >
              <ScrollIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold sm:text-2xl" style={{ color: 'var(--ink)' }}>
                Mục lục chương ({detail.chapters.length})
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Chọn chương bất kỳ để bắt đầu đọc nối chương tự động
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={jump}
              onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const n = parseInt(jump, 10);
                  if (n > 0) navigate(`/read/${sourceId}/${encodeURIComponent(detail.id)}/${n}`);
                }
              }}
              placeholder="Nhảy tới chương số..."
              inputMode="numeric"
              aria-label="Nhảy tới chương số"
              className={`h-10 w-44 border bg-[var(--card-bg)] px-4 text-sm outline-none ${
                isSwiss ? '' : 'rounded-full'
              }`}
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            <button
              onClick={() => {
                const n = parseInt(jump, 10);
                if (n > 0) navigate(`/read/${sourceId}/${encodeURIComponent(detail.id)}/${n}`);
              }}
              className={`h-10 cursor-pointer px-5 text-sm font-bold text-white ${
                isSwiss ? '' : 'rounded-full'
              }`}
              style={{ background: 'var(--brand)' }}
            >
              Đi
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleChapters.map((c) => {
            const isCurrent = c.number === continueChapter;
            return (
              <Link
                key={c.number}
                to={`/read/${sourceId}/${encodeURIComponent(detail.id)}/${c.number}`}
                className={`flex items-center justify-between gap-2 border px-3.5 py-2.5 text-sm transition hover:border-[var(--brand)] ${
                  isSwiss ? '' : 'rounded-xl'
                }`}
                style={
                  isCurrent
                    ? {
                        borderColor: 'var(--brand)',
                        background: 'var(--brand-soft)',
                        color: 'var(--brand-strong)',
                        fontWeight: 600,
                      }
                    : {
                        borderColor: 'var(--border)',
                        background: 'var(--card-bg)',
                        color: 'var(--ink)',
                      }
                }
              >
                <span className="truncate">{c.title}</span>
                {isCurrent && (
                  <BookmarkIcon className="h-3.5 w-3.5 shrink-0" />
                )}
              </Link>
            );
          })}
        </div>

        {showCount < detail.chapters.length && (
          <button
            onClick={() => setShowCount((c) => c + PAGE_SIZE * 2)}
            className={`mt-6 w-full cursor-pointer border py-3 text-sm font-bold transition hover:opacity-85 ${
              isSwiss ? '' : 'rounded-2xl'
            }`}
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-alt)',
              color: 'var(--brand-strong)',
            }}
          >
            Xem thêm chương ({detail.chapters.length - showCount} chương còn lại)
          </button>
        )}
      </div>
    </div>
  );
}

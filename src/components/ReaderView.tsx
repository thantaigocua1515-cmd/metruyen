import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChapterContent } from '../lib/novelApi';
import type { ApiSourceRow, ChapterMeta, NovelSummary } from '../lib/novelApi';
import { getSyncedChapter } from '../lib/library';
import { getSupabase } from '../lib/supabase';
import { bumpStat } from '../lib/gamification';
import { useChrome } from '../context/ChromeContext';
import { useTemplate } from '../context/TemplateContext';

interface Block {
  num: number;
  title: string;
  content: string;
}

interface Props {
  source: ApiSourceRow;
  novel: NovelSummary;
  chapters: ChapterMeta[];
  startChapter: number;
  userId: string | null;
}

function ContentBody({ text }: { text: string }) {
  const looksHtml = /<\s*(p|div|br|h\d|span)[\s>]/i.test(text);
  if (looksHtml) {
    const clean = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    return <div dangerouslySetInnerHTML={{ __html: clean }} />;
  }
  return (
    <>
      {text.split(/\n+/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

export default function ReaderView({ source, novel, chapters, startChapter, userId }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('mt-reader-size')) || 18;
    } catch {
      return 18;
    }
  });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  loadingRef.current = loading;
  const startedRef = useRef(false);

  const { toggle: toggleChrome, setHidden: setChromeHidden } = useChrome();
  const { template } = useTemplate();
  const tapRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    return () => setChromeHidden(false);
  }, [setChromeHidden]);

  useEffect(() => {
    const id = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(id);
  }, []);

  const changeFontSize = (delta: number) => {
    setFontSize((s) => {
      const next = Math.min(26, Math.max(15, s + delta));
      try {
        localStorage.setItem('mt-reader-size', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    tapRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = tapRef.current;
    tapRef.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    const dt = Date.now() - start.t;
    if (dx > 12 || dy > 12 || dt > 350) return;
    const el = e.target as HTMLElement | null;
    if (el?.closest('a, button, input, select, textarea, [role="button"]')) return;
    setShowHint(false);
    toggleChrome();
  };

  const saveProgress = useCallback(
    async (chapterNum: number) => {
      if (!userId) return;
      try {
        const supabase = getSupabase();
        await supabase.from('reading_progress').upsert(
          {
            user_id: userId,
            source_id: source.id,
            novel_id: novel.id,
            chapter: chapterNum,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,source_id,novel_id' },
        );
        void bumpStat(userId, 'read_chapters', 1);
        const h = new Date().getHours();
        if (h >= 0 && h < 5) void bumpStat(userId, 'night_reads', 1);
        try {
          const { count } = await supabase
            .from('reading_progress')
            .select('novel_id', { count: 'exact', head: true })
            .eq('user_id', userId);
          if (count != null) void bumpStat(userId, 'novels_read', count, 'set');
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    },
    [userId, source.id, novel.id],
  );

  const loadChapter = useCallback(
    async (num: number) => {
      setLoading(true);
      setError(null);
      try {
        let content: string;
        let dbTitle: string | undefined;
        try {
          const synced = await getSyncedChapter(`${source.id}:${novel.id}`, num);
          if (synced) {
            content = synced.content;
            dbTitle = synced.title?.trim() || undefined;
          } else {
            content = await fetchChapterContent(source, novel.id, num);
          }
        } catch {
          content = await fetchChapterContent(source, novel.id, num);
        }
        const meta = chapters.find((c) => c.number === num);
        setBlocks((prev) => {
          if (prev.some((b) => b.num === num)) return prev;
          return [...prev, { num, title: dbTitle ?? meta?.title ?? `Chương ${num}`, content }].sort(
            (a, b) => a.num - b.num,
          );
        });
        void saveProgress(num);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Tải chương thất bại.';
        if (/\b404\b/.test(msg)) {
          setEnded(true);
          setError(null);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [source, novel.id, chapters, saveProgress],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void loadChapter(startChapter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastNum = blocks.length ? Math.max(...blocks.map((b) => b.num)) : startChapter - 1;
  const nextNum: number | null = (() => {
    if (ended) return null;
    const nx = chapters
      .filter((c) => c.number > lastNum)
      .sort((a, b) => a.number - b.number)[0];
    return nx ? nx.number : null;
  })();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || nextNum === null) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          void loadChapter(nextNum);
        }
      },
      { rootMargin: '800px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextNum, loadChapter]);

  const isCoPhong = template === 'co-phong';
  const isSwiss = template === 'toi-gian';

  return (
    <article
      className="relative mx-auto max-w-3xl px-4 py-6 sm:px-6"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {showHint && (
        <div className="pointer-events-none sticky top-3 z-10 mb-3 flex justify-center">
          <span
            className="rounded-full px-4 py-1.5 text-xs font-semibold shadow-lg backdrop-blur"
            style={{ background: 'var(--ink)', color: 'var(--page-bg)' }}
          >
            Chạm vào giữa màn hình để ẩn/hiện thanh điều hướng
          </span>
        </div>
      )}

      {/* Thanh tùy chỉnh cỡ chữ */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl" style={{ color: 'var(--ink)' }}>
            {novel.title}
          </h1>
          {novel.author && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Tác giả: {novel.author}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => changeFontSize(-1)}
            className="cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-bold transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', background: 'var(--card-bg)', color: 'var(--ink)' }}
            title="Giảm cỡ chữ"
          >
            A-
          </button>
          <span className="px-1.5 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            {fontSize}px
          </span>
          <button
            type="button"
            onClick={() => changeFontSize(1)}
            className="cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-bold transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', background: 'var(--card-bg)', color: 'var(--ink)' }}
            title="Tăng cỡ chữ"
          >
            A+
          </button>
        </div>
      </div>

      <div className="space-y-12">
        {blocks.map((b) => (
          <section
            key={b.num}
            className={`animate-fade-up ${
              isCoPhong
                ? 'cophong-frame p-6 sm:p-10'
                : isSwiss
                  ? 'border p-6 sm:p-10'
                  : 'rounded-3xl border p-6 shadow-sm sm:p-10'
            }`}
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
            }}
          >
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
              <h2
                className="font-display text-center text-lg font-bold sm:text-2xl"
                style={{ color: 'var(--brand)' }}
              >
                {b.title}
              </h2>
              <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
            </div>
            <div
              className="chapter-content"
              style={{ fontSize: `${fontSize}px`, color: 'var(--ink)' }}
            >
              {b.content ? (
                <ContentBody text={b.content} />
              ) : (
                <p className="italic" style={{ color: 'var(--muted)' }}>
                  (Chương này chưa có nội dung.)
                </p>
              )}
            </div>
          </section>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}{' '}
          <button onClick={() => nextNum !== null && loadChapter(nextNum)} className="underline">
            Thử lại
          </button>
        </div>
      )}

      <div ref={sentinelRef} className="py-10 text-center">
        {loading && (
          <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
            Đang nối chương tiếp theo...
          </p>
        )}
        {!loading && (ended || nextNum === null) && blocks.length > 0 && (
          <p className="text-sm italic" style={{ color: 'var(--muted)' }}>
            — Đã tới chương mới nhất —
          </p>
        )}
        {!loading && ended && blocks.length === 0 && !error && (
          <p className="text-sm italic" style={{ color: 'var(--muted)' }}>
            Nguồn dữ liệu chưa có nội dung chương này.
          </p>
        )}
      </div>
    </article>
  );
}

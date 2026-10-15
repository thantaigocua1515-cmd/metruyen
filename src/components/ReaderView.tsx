import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChapterContent } from '../lib/novelApi';
import type { ApiSourceRow, ChapterMeta, NovelSummary } from '../lib/novelApi';
import { getSupabase } from '../lib/supabase';

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

/**
 * Trình đọc cuộn vô hạn: IntersectionObserver ở cuối trang tự tải chương
 * tiếp theo nối vào, đồng thời lưu reading_progress.
 * (Parent nên key component theo startChapter để reset khi đổi chương.)
 */
export default function ReaderView({ source, novel, chapters, startChapter, userId }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  loadingRef.current = loading;
  const startedRef = useRef(false);

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
      } catch {
        /* lưu tiến độ thất bại thì bỏ qua, không chặn đọc */
      }
    },
    [userId, source.id, novel.id],
  );

  const loadChapter = useCallback(
    async (num: number) => {
      setLoading(true);
      setError(null);
      try {
        const content = await fetchChapterContent(source, novel.id, num);
        const meta = chapters.find((c) => c.number === num);
        setBlocks((prev) => {
          if (prev.some((b) => b.num === num)) return prev;
          return [...prev, { num, title: meta?.title ?? `Chương ${num}`, content }].sort(
            (a, b) => a.num - b.num,
          );
        });
        void saveProgress(num);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Tải chương thất bại.');
      } finally {
        setLoading(false);
      }
    },
    [source, novel.id, chapters, saveProgress],
  );

  // Tải chương đầu khi mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void loadChapter(startChapter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Số chương tiếp theo cần tải
  const lastNum = blocks.length ? Math.max(...blocks.map((b) => b.num)) : startChapter - 1;
  const nextNum: number | null = (() => {
    const nx = chapters
      .filter((c) => c.number > lastNum)
      .sort((a, b) => a.number - b.number)[0];
    return nx ? nx.number : null;
  })();

  // Cuộn tới gần cuối → tự tải chương tiếp theo
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

  return (
    <article className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-center text-2xl font-bold text-amber-950 dark:text-amber-100">
        {novel.title}
      </h1>
      {novel.author && (
        <p className="mt-1 text-center text-sm text-stone-500 dark:text-stone-400">
          Tác giả: {novel.author}
        </p>
      )}

      <div className="mt-6 space-y-10">
        {blocks.map((b) => (
          <section key={b.num} className="animate-fade-up">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-amber-900/20 dark:bg-amber-100/15" />
              <h2 className="font-display text-lg font-bold text-amber-800 dark:text-amber-300">
                {b.title}
              </h2>
              <span className="h-px flex-1 bg-amber-900/20 dark:bg-amber-100/15" />
            </div>
            <div className="chapter-content text-[17px] text-stone-800 dark:text-stone-200">
              {b.content ? (
                <ContentBody text={b.content} />
              ) : (
                <p className="italic text-stone-400">(Chương này chưa có nội dung.)</p>
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

      <div ref={sentinelRef} className="py-8 text-center">
        {loading && <p className="text-sm text-stone-500 dark:text-stone-400">📖 Đang nối chương tiếp theo...</p>}
        {!loading && nextNum === null && blocks.length > 0 && (
          <p className="text-sm italic text-stone-500 dark:text-stone-400">
            — Hết chương (hoặc API chưa có chương tiếp theo) —
          </p>
        )}
      </div>
    </article>
  );
}

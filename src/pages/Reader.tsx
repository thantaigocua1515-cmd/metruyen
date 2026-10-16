import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { fetchNovelDetail } from '../lib/novelApi';
import type { ApiSourceRow, NovelDetail as NovelDetailType } from '../lib/novelApi';
import { getSyncedNovel, getSyncedNovelChapterList } from '../lib/library';
import { useAuth } from '../context/AuthContext';
import ReaderView from '../components/ReaderView';
import { updatePresenceReading } from '../lib/presence';

/** +1 linh thạch mỗi 5 phút đọc (300 giây). */
const STONES_PER_5MIN = 1;

export default function Reader() {
  const { sourceId, novelId, chapter } = useParams<{
    sourceId: string;
    novelId: string;
    chapter: string;
  }>();
  const { user, refreshProfile } = useAuth();
  const [source, setSource] = useState<ApiSourceRow | null>(null);
  const [detail, setDetail] = useState<NovelDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chapterNum = Math.max(1, parseInt(chapter ?? '1', 10) || 1);

  // Báo cho mọi người biết mình đang đọc truyện gì, chương mấy
  useEffect(() => {
    if (detail && novelId) {
      void updatePresenceReading({
        novel_id: `${sourceId}:${detail.id}`,
        novel_title: detail.title,
        chapter: chapterNum,
      });
    }
  }, [detail?.title, novelId, sourceId, chapterNum]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!sourceId || !novelId) return;
      try {
        if (sourceId === 'manual') {
          // Truyện nhập tay: đọc trực tiếp từ DB
          const row = await getSyncedNovel(`${sourceId}:${novelId}`);
          if (!row) throw new Error('Không tìm thấy truyện.');
          const syncedList = await getSyncedNovelChapterList(row.id).catch(() => []);
          const src: ApiSourceRow = {
            id: 'manual',
            name: '📝 Nhập tay',
            openapi_url: '',
            base_url: null,
            is_active: true,
          };
          const d: NovelDetailType = {
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
          if (alive) {
            setSource(src);
            setDetail(d);
          }
          return;
        }
        const supabase = getSupabase();
        const { data: sRow, error: sErr } = await supabase
          .from('api_sources')
          .select('id,name,openapi_url,base_url,is_active')
          .eq('id', sourceId)
          .single();
        if (sErr || !sRow) throw new Error('Không tìm thấy nguồn truyện.');
        const src = sRow as ApiSourceRow;
        const d = await fetchNovelDetail(src, novelId);
        if (alive) {
          setSource(src);
          setDetail(d);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Tải truyện thất bại.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [sourceId, novelId]);

  // Tính giờ đọc: mỗi 60 giây (tab đang mở) cộng 60s + ghi session + linh thạch
  useEffect(() => {
    if (!user) return;
    let accSeconds = 0;
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const supabase = getSupabase();
        const { data: cur } = await supabase
          .from('profiles')
          .select('reading_seconds,spirit_stones')
          .eq('id', user.id)
          .single();
        if (!cur) return;
        const row = cur as { reading_seconds: number; spirit_stones: number };
        accSeconds += 60;
        const earned =
          Math.floor(accSeconds / 300) - Math.floor((accSeconds - 60) / 300);
        await supabase
          .from('profiles')
          .update({
            reading_seconds: row.reading_seconds + 60,
            spirit_stones: row.spirit_stones + earned * STONES_PER_5MIN,
          })
          .eq('id', user.id);
        await supabase.from('reading_sessions').insert({ user_id: user.id, seconds: 60 });
        void refreshProfile();
      } catch {
        /* lỗi mạng thì bỏ qua tick này */
      }
    }, 60000);
    return () => window.clearInterval(timer);
  }, [user, refreshProfile]);

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link to="/" className="mt-2 inline-block text-amber-700 underline dark:text-amber-300">
          ← Về trang chủ
        </Link>
      </div>
    );
  }

  if (!source || !detail) {
    return (
      <p className="py-16 text-center text-stone-500 dark:text-stone-400">
        📖 Đang mở chương {chapterNum}...
      </p>
    );
  }

  return (
    <div className="bg-amber-50/50 dark:bg-stone-950">
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <Link
          to={`/novel/${sourceId}/${encodeURIComponent(detail.id)}`}
          className="text-sm text-amber-800 hover:underline dark:text-amber-300"
        >
          ← {detail.title}
        </Link>
      </div>
      <ReaderView
        key={`${sourceId}:${detail.id}:${chapterNum}`}
        source={source}
        novel={detail}
        chapters={detail.chapters}
        startChapter={chapterNum}
        userId={user?.id ?? null}
      />
    </div>
  );
}

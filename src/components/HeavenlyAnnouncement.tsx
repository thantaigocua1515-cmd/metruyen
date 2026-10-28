import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabase';

interface Announcement {
  id: string;
  message: string;
  created_at: string;
}

const SEEN_KEY = 'mt_seen_announcements';
const RECENT_MINUTES = 10;

function getSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const seen = getSeen();
    seen.add(id);
    // chỉ giữ 50 id gần nhất
    const arr = [...seen].slice(-50);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    /* bỏ qua */
  }
}

/**
 * Lắng nghe "Thông báo thiên đạo" từ admin theo thời gian thực.
 * User đang online sẽ thấy popup ngay khi admin gửi.
 */
export default function HeavenlyAnnouncement() {
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState<Announcement | null>(null);
  const queueRef = useRef<Announcement[]>([]);
  const seenRef = useRef<Set<string>>(getSeen());

  const push = (a: Announcement) => {
    if (seenRef.current.has(a.id)) return;
    seenRef.current.add(a.id);
    markSeen(a.id);
    queueRef.current = [...queueRef.current, a];
    setQueue([...queueRef.current]);
  };

  useEffect(() => {
    const sb = getSupabase();

    // 1. Lấy thông báo gần đây (phòng khi vừa mở web đã có thông báo mới)
    (async () => {
      try {
        const since = new Date(Date.now() - RECENT_MINUTES * 60_000).toISOString();
        const { data } = await sb
          .from('announcements')
          .select('id, message, created_at')
          .gt('created_at', since)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true })
          .limit(5);
        ((data ?? []) as Announcement[]).forEach(push);
      } catch {
        /* bỏ qua */
      }
    })();

    // 2. Realtime: thông báo mới từ admin
    const ch = sb
      .channel('heavenly-announcements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          const row = payload.new as Announcement;
          if (row && row.id && row.message) push(row);
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // hiện từng thông báo một
  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      queueRef.current = rest;
      setQueue(rest);
      setCurrent(next);
    }
  }, [queue, current]);

  if (!current) return null;

  const time = new Date(current.created_at).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      {/* hào quang */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[120vmax] w-[120vmax] -translate-x-1/2 -translate-y-1/2 animate-[spin_24s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(251,191,36,0.07)_20deg,transparent_40deg,rgba(251,191,36,0.07)_60deg,transparent_80deg,rgba(251,191,36,0.07)_100deg,transparent_120deg,rgba(251,191,36,0.07)_140deg,transparent_160deg,rgba(251,191,36,0.07)_180deg,transparent_200deg,rgba(251,191,36,0.07)_220deg,transparent_240deg,rgba(251,191,36,0.07)_260deg,transparent_280deg,rgba(251,191,36,0.07)_300deg,transparent_320deg,rgba(251,191,36,0.07)_340deg,transparent_360deg)]" />
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-amber-400/70 bg-gradient-to-b from-stone-900 via-[#1c1410] to-stone-900 shadow-[0_0_80px_rgba(251,191,36,0.25)]">
        {/* dải trên */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-500 to-amber-700 px-4 py-2 text-center">
          <p className="font-display text-lg font-bold tracking-[0.3em] text-stone-950">
            📜 THÔNG BÁO
          </p>
        </div>

        <div className="px-6 py-6 text-center">
          <p className="title-shine font-display text-2xl font-bold tracking-widest">
            THIÊN ĐẠO
          </p>
          <div className="mx-auto my-4 h-px w-2/3 bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
          <p className="whitespace-pre-wrap font-display text-xl leading-relaxed text-amber-100">
            {current.message}
          </p>
          <p className="mt-4 text-xs text-stone-500">🕐 {time}</p>
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={() => setCurrent(null)}
            className="w-full rounded-full bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 font-bold text-stone-950 shadow-lg transition hover:from-amber-500 hover:to-amber-400 active:scale-95"
          >
            Tuân lệnh 🙏
          </button>
        </div>
      </div>
    </div>
  );
}

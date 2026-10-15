import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { getRank, formatHours } from '../lib/tuvi';
import { fetchEquippedMap } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';
import AvatarWithFrame from './AvatarWithFrame';

interface Row {
  id: string;
  username: string;
  avatar_url: string | null;
  reading_seconds: number;
}

type Equipped = { frame: EquippedItem | null; treasure: EquippedItem | null };

const MEDALS = ['🥇', '🥈', '🥉'];

/** Bảng xếp hạng giờ đọc / tu vi — cập nhật thời gian thực qua Realtime. */
export default function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [equipped, setEquipped] = useState<Record<string, Equipped>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    let alive = true;

    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, reading_seconds')
        .order('reading_seconds', { ascending: false })
        .limit(50);
      if (!alive) return;
      const list = (data ?? []) as Row[];
      setRows(list);
      // Lấy khung + pháp bảo đang trang bị để hiển thị cạnh avatar
      try {
        const map = await fetchEquippedMap(list.map((r) => r.id));
        if (alive) setEquipped(map);
      } catch {
        /* không chặn BXH nếu lỗi */
      }
      if (alive) setLoading(false);
    };

    void load();
    const channel = supabase
      .channel('leaderboard-profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => void load(),
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <p className="py-10 text-center text-stone-500 dark:text-stone-400">Đang tải bảng xếp hạng...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-center text-2xl font-bold text-amber-950 dark:text-amber-100">
        🏆 Bảng Xếp Hạng Tu Vi
      </h1>
      <p className="mt-1 text-center text-sm text-stone-500 dark:text-stone-400">
        Cập nhật thời gian thực theo giờ đọc
      </p>

      <div className="mt-6 space-y-2">
        {rows.map((r, i) => {
          const rank = getRank(r.reading_seconds / 3600);
          const eq = equipped[r.id];
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-amber-900/15 bg-white p-3 shadow-sm dark:border-amber-100/10 dark:bg-stone-900"
            >
              <span className="w-8 text-center text-xl font-bold text-stone-500 dark:text-stone-400">
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <Link
                to={`/user/${r.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
                title={`Xem trang của ${r.username}`}
              >
                <AvatarWithFrame
                  src={r.avatar_url}
                  size={44}
                  username={r.username}
                  frame={eq?.frame ?? null}
                  treasure={eq?.treasure ?? null}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-900 hover:text-amber-700 dark:text-stone-100 dark:hover:text-amber-300">
                    {r.username}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ⚔️ {rank.name} · ⏳ {formatHours(r.reading_seconds)}
                  </p>
                </div>
              </Link>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{ width: `${rank.progress}%` }}
                />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="py-10 text-center italic text-stone-500 dark:text-stone-400">
            Chưa có đạo hữu nào lên bảng. Hãy là người đầu tiên!
          </p>
        )}
      </div>
    </div>
  );
}

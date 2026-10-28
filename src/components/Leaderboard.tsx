import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { getRank, formatHours } from '../lib/tuvi';
import { fetchEquippedMap } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';
import { getEquippedTitlesMap, type TitleRow } from '../lib/gamification';
import AvatarWithFrame from './AvatarWithFrame';

interface Row {
  id: string;
  username: string;
  avatar_url: string | null;
  reading_seconds: number;
  spirit_stones: number;
}

type Equipped = { frame: EquippedItem | null; treasure: EquippedItem | null };
type LbTab = 'tuvi' | 'hours' | 'wealth';

const MEDALS = ['🥇', '🥈', '🥉'];

const TABS: { id: LbTab; label: string; hint: string }[] = [
  { id: 'tuvi', label: '🏆 Tu Vi', hint: 'Cảnh giới tu vi theo tổng giờ đọc' },
  { id: 'hours', label: '⏱️ Giờ Đọc', hint: 'Tổng thời gian đọc truyện' },
  { id: 'wealth', label: '💎 Tài Phú', hint: 'Linh thạch đang sở hữu' },
];

function TitleBadge({ title }: { title: TitleRow | undefined }) {
  if (!title) return null;
  const anim = title.animation === 'shine' ? 'title-shine' : title.animation === 'blink' ? 'title-blink' : '';
  return (
    <span
      className={`user-title ${anim}`}
      style={{ color: title.color, textShadow: `0 0 8px ${title.glow}, 0 0 20px ${title.glow}` }}
    >
      {title.name}
    </span>
  );
}

/** Bảng xếp hạng 3 tab: Tu Vi / Giờ Đọc / Tài Phú — realtime qua Realtime. */
export default function Leaderboard() {
  const [tab, setTab] = useState<LbTab>('tuvi');
  const [rows, setRows] = useState<Row[]>([]);
  const [equipped, setEquipped] = useState<Record<string, Equipped>>({});
  const [titles, setTitles] = useState<Record<string, TitleRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    let alive = true;

    const load = async () => {
      const orderCol = tab === 'wealth' ? 'spirit_stones' : 'reading_seconds';
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, reading_seconds, spirit_stones')
        .order(orderCol, { ascending: false })
        .limit(50);
      if (!alive) return;
      const list = (data ?? []) as Row[];
      setRows(list);
      try {
        const [map, tmap] = await Promise.all([
          fetchEquippedMap(list.map((r) => r.id)),
          getEquippedTitlesMap(list.map((r) => r.id)),
        ]);
        if (alive) {
          setEquipped(map);
          setTitles(tmap);
        }
      } catch {
        /* không chặn BXH nếu lỗi */
      }
      if (alive) setLoading(false);
    };

    setLoading(true);
    void load();
    const channel = supabase
      .channel('leaderboard-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void load())
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [tab]);

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-center text-2xl font-bold text-amber-950 dark:text-amber-100">
        🏆 Bảng Xếp Hạng
      </h1>
      <p className="mt-1 text-center text-sm text-stone-500 dark:text-stone-400">
        {active.hint} · cập nhật thời gian thực
      </p>

      <div className="mt-4 flex justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${
              tab === t.id
                ? 'bg-amber-700 text-white dark:bg-amber-600'
                : 'border border-amber-700/40 text-amber-800 dark:border-amber-500/40 dark:text-amber-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab !== 'wealth' && (
        <p className="mt-2 text-center text-xs italic text-stone-400 dark:text-stone-500">
          Tu vi tính từ giờ đọc nên thứ hạng 2 tab đầu giống nhau, khác cách hiển thị.
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-stone-500 dark:text-stone-400">Đang tải bảng xếp hạng...</p>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((r, i) => {
            const rank = getRank(r.reading_seconds / 3600);
            const eq = equipped[r.id];
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-amber-900/15 bg-white p-3 shadow-sm dark:border-amber-100/10 dark:bg-stone-900"
              >
                <span className="w-8 shrink-0 text-center text-xl font-bold text-stone-500 dark:text-stone-400">
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
                    <div className="mt-0.5">
                      <TitleBadge title={titles[r.id]} />
                    </div>
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                      {tab === 'tuvi' && (
                        <>
                          ⚔️ {rank.name} · ⏳ {formatHours(r.reading_seconds)}
                        </>
                      )}
                      {tab === 'hours' && <>⏳ {formatHours(r.reading_seconds)} đọc truyện</>}
                      {tab === 'wealth' && <>💎 {r.spirit_stones.toLocaleString('vi-VN')} linh thạch</>}
                    </p>
                  </div>
                </Link>
                {tab === 'tuvi' ? (
                  <div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                      style={{ width: `${rank.progress}%` }}
                    />
                  </div>
                ) : (
                  <span className="shrink-0 text-lg font-bold text-amber-700 dark:text-amber-300">
                    {tab === 'hours' ? formatHours(r.reading_seconds) : `💎${r.spirit_stones.toLocaleString('vi-VN')}`}
                  </span>
                )}
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="py-10 text-center italic text-stone-500 dark:text-stone-400">
              Chưa có đạo hữu nào lên bảng. Hãy là người đầu tiên!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

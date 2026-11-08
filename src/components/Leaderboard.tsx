import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { getRank, formatHours } from '../lib/tuvi';
import { fetchEquippedMap } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';
import { getEquippedTitlesMap, type TitleRow } from '../lib/gamification';
import { useTemplate } from '../context/TemplateContext';
import AvatarWithFrame from './AvatarWithFrame';
import { ClockIcon, GemIcon, SparklesIcon, TrophyIcon } from './icons';

interface Row {
  id: string;
  username: string;
  avatar_url: string | null;
  reading_seconds: number;
  spirit_stones: number;
}

type Equipped = { frame: EquippedItem | null; treasure: EquippedItem | null };
type LbTab = 'tuvi' | 'hours' | 'wealth';

const TABS: { id: LbTab; label: string; hint: string }[] = [
  { id: 'tuvi', label: 'Tu Vi Bảng', hint: 'Cảnh giới tu vi theo tổng giờ đọc' },
  { id: 'hours', label: 'Thời Gian Bảng', hint: 'Tổng thời gian đọc truyện tích lũy' },
  { id: 'wealth', label: 'Phú Hộ Bảng', hint: 'Linh thạch đang sở hữu trong túi' },
];

function TitleBadge({ title }: { title: TitleRow | undefined }) {
  if (!title) return null;
  const anim =
    title.animation === 'neon'
      ? 'title-neon'
      : title.animation === 'shine'
        ? 'title-shine'
        : title.animation === 'blink'
          ? 'title-blink'
          : '';
  return (
    <span
      className={`user-title ${anim}`}
      style={{ color: title.color, textShadow: `0 0 8px ${title.glow}, 0 0 20px ${title.glow}` }}
    >
      {title.name}
    </span>
  );
}

export default function Leaderboard() {
  const { template } = useTemplate();
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
        /* ignore */
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
  const isSwiss = template === 'toi-gian';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="text-center">
        <span
          className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
        >
          <TrophyIcon className="h-6 w-6" />
        </span>
        <h1 className="font-display mt-3 text-3xl font-bold sm:text-4xl" style={{ color: 'var(--ink)' }}>
          Phong Thần Bảng
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {active.hint} • Cập nhật thời gian thực
        </p>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {TABS.map((t) => {
          const isAct = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`cursor-pointer border px-5 py-2 text-sm font-bold transition ${
                isSwiss ? 'font-mono-tech uppercase' : 'rounded-full'
              }`}
              style={
                isAct
                  ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                  : { background: 'var(--card-bg)', color: 'var(--ink)', borderColor: 'var(--border)' }
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="py-16 text-center" style={{ color: 'var(--muted)' }}>
          Đang mở Phong Thần Bảng...
        </p>
      ) : (
        <div className="mt-6 space-y-2.5">
          {rows.map((r, i) => {
            const rank = getRank(r.reading_seconds / 3600);
            const eq = equipped[r.id];
            const isTop3 = i < 3;
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3.5 border p-3.5 shadow-sm transition hover:border-[var(--brand)] ${
                  isSwiss ? '' : 'rounded-2xl'
                }`}
                style={{
                  borderColor: isTop3 ? 'var(--brand)' : 'var(--border)',
                  background: 'var(--card-bg)',
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
                  style={
                    i === 0
                      ? { background: '#f59e0b', color: '#fff' }
                      : i === 1
                        ? { background: '#94a3b8', color: '#fff' }
                        : i === 2
                          ? { background: '#d97706', color: '#fff' }
                          : { background: 'var(--surface-alt)', color: 'var(--muted)' }
                  }
                >
                  {i + 1}
                </span>

                <Link
                  to={`/user/${r.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3.5"
                  title={`Xem trang của ${r.username}`}
                >
                  <AvatarWithFrame
                    src={r.avatar_url}
                    size={46}
                    username={r.username}
                    frame={eq?.frame ?? null}
                    treasure={eq?.treasure ?? null}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold" style={{ color: 'var(--ink)' }}>
                        {r.username}
                      </p>
                      <TitleBadge title={titles[r.id]} />
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--brand-strong)' }}>
                      {tab === 'tuvi' && (
                        <>
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <SparklesIcon className="h-3.5 w-3.5" /> {rank.name}
                          </span>
                          <span style={{ color: 'var(--muted)' }}>
                            • {formatHours(r.reading_seconds)}
                          </span>
                        </>
                      )}
                      {tab === 'hours' && (
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <ClockIcon className="h-3.5 w-3.5" /> {formatHours(r.reading_seconds)} tu luyện
                        </span>
                      )}
                      {tab === 'wealth' && (
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <GemIcon className="h-3.5 w-3.5" /> {r.spirit_stones.toLocaleString('vi-VN')} linh thạch
                        </span>
                      )}
                    </p>
                  </div>
                </Link>

                {tab === 'tuvi' ? (
                  <div className="hidden h-2 w-24 shrink-0 overflow-hidden rounded-full bg-black/10 sm:block dark:bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${rank.progress}%`, background: 'var(--brand)' }}
                    />
                  </div>
                ) : (
                  <span className="shrink-0 text-sm font-extrabold sm:text-base" style={{ color: 'var(--brand)' }}>
                    {tab === 'hours'
                      ? formatHours(r.reading_seconds)
                      : `${r.spirit_stones.toLocaleString('vi-VN')}`}
                  </span>
                )}
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="py-12 text-center italic" style={{ color: 'var(--muted)' }}>
              Chưa có đạo hữu nào lên bảng. Hãy là người đầu tiên!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

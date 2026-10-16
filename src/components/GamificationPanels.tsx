import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  claimAchievement,
  claimQuest,
  ensureQuestRows,
  equipTitle,
  getAchievementsWithProgress,
  getMyTitles,
  getQuestsWithProgress,
  toast,
  type AchievementView,
  type MyTitle,
  type Period,
  type QuestView,
} from '../lib/gamification';
import { titleAnimClass, titleStyle } from './UserTitle';

const card =
  'rounded-2xl border border-amber-900/15 bg-white p-4 shadow-sm dark:border-amber-100/10 dark:bg-stone-900';
const btnPrimary =
  'rounded-full bg-amber-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500';
const btnGhost =
  'rounded-full border border-amber-700/40 px-4 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-stone-800';

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function fmtTarget(t: string, v: number): string {
  if (t === 'read_seconds') {
    if (v >= 3600) return `${v / 3600} giờ`;
    return `${Math.round(v / 60)} phút`;
  }
  return v.toLocaleString('vi-VN');
}

function fmtProgress(t: string, v: number): string {
  if (t === 'read_seconds') {
    if (v >= 3600) return `${(v / 3600).toFixed(1)} giờ`;
    if (v >= 60) return `${Math.round(v / 60)} phút`;
    return `${v} giây`;
  }
  return v.toLocaleString('vi-VN');
}

/* ---------------- Tab Nhiệm vụ ---------------- */

const PERIODS: { id: Period; label: string }[] = [
  { id: 'daily', label: '📅 Ngày' },
  { id: 'weekly', label: '🗓️ Tuần' },
  { id: 'monthly', label: '📆 Tháng' },
];

export function QuestPanel({ userId }: { userId: string }) {
  const [period, setPeriod] = useState<Period>('daily');
  const [quests, setQuests] = useState<QuestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await ensureQuestRows(userId);
    setQuests(await getQuestsWithProgress(userId, period));
    setLoading(false);
  }, [userId, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = async (q: QuestView) => {
    setClaiming(q.id);
    try {
      const reward = await claimQuest(userId, q.id);
      toast(`💎 Nhận ${reward} linh thạch từ "${q.name}"!`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Nhận thưởng thất bại.');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${
              period === p.id
                ? 'bg-amber-700 text-white dark:bg-amber-600'
                : 'border border-amber-700/40 text-amber-800 dark:border-amber-500/40 dark:text-amber-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">Đang tải nhiệm vụ...</p>
      ) : quests.length === 0 ? (
        <p className="py-8 text-center text-sm italic text-stone-500 dark:text-stone-400">
          Chưa có nhiệm vụ nào cho kỳ này.
        </p>
      ) : (
        quests.map((q) => (
          <div key={q.id} className={card}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-stone-900 dark:text-stone-100">{q.name}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">{q.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                💎 {q.reward_stones}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1">
                <ProgressBar value={q.progress} max={q.target_value} />
              </div>
              <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
                {fmtProgress(q.target_type, Math.min(q.progress, q.target_value))}/
                {fmtTarget(q.target_type, q.target_value)}
              </span>
            </div>
            <div className="mt-2">
              {q.claimed ? (
                <span className="text-xs font-semibold text-stone-400">✅ Đã nhận thưởng</span>
              ) : q.completed ? (
                <button onClick={() => void claim(q)} disabled={claiming === q.id} className={btnPrimary}>
                  {claiming === q.id ? 'Đang nhận...' : '🎁 Nhận thưởng'}
                </button>
              ) : (
                <span className="text-xs text-stone-500 dark:text-stone-400">Chưa hoàn thành</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ---------------- Tab Thành tựu ---------------- */

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'reading', label: '📖 Đọc truyện' },
  { id: 'cultivation', label: '⚔️ Tu vi' },
  { id: 'wealth', label: '💎 Tài phú' },
  { id: 'collection', label: '🎒 Sưu tầm' },
  { id: 'streak', label: '🔥 Kiên trì' },
  { id: 'explore', label: '🧭 Khám phá' },
];

export function AchievementPanel({ userId }: { userId: string }) {
  const [achs, setAchs] = useState<AchievementView[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setAchs(await getAchievementsWithProgress(userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = async (a: AchievementView) => {
    setClaiming(a.id);
    try {
      const reward = await claimAchievement(userId, a.id);
      toast(`💎 Nhận ${reward} linh thạch từ "${a.name}"!`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Nhận thưởng thất bại.');
    } finally {
      setClaiming(null);
    }
  };

  const grouped = useMemo(() => {
    const g = new Map<string, AchievementView[]>();
    for (const a of achs) {
      const arr = g.get(a.category) ?? [];
      arr.push(a);
      g.set(a.category, arr);
    }
    return CATEGORIES.map((c) => ({ ...c, items: g.get(c.id) ?? [] })).filter((c) => c.items.length > 0);
  }, [achs]);

  const doneCount = achs.filter((a) => a.completed).length;

  if (loading) {
    return <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">Đang tải thành tựu...</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Đã mở khóa <span className="font-bold text-amber-700 dark:text-amber-300">{doneCount}/{achs.length}</span> thành
        tựu
      </p>
      {grouped.map((g) => (
        <div key={g.id}>
          <p className="mb-2 font-bold text-stone-800 dark:text-stone-200">{g.label}</p>
          <div className="space-y-2">
            {g.items.map((a) => (
              <div key={a.id} className={`${card} ${a.completed ? '' : 'opacity-80'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{a.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-stone-900 dark:text-stone-100">{a.name}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{a.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1">
                        <ProgressBar value={a.progress} max={a.target_value} />
                      </div>
                      <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
                        {fmtProgress(a.target_type, Math.min(a.progress, a.target_value))}/
                        {fmtTarget(a.target_type, a.target_value)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        💎 {a.reward_stones}
                      </span>
                      {a.reward_title_code && (
                        <span className="text-xs text-stone-500 dark:text-stone-400">+ 👑 danh hiệu</span>
                      )}
                      {a.claimed ? (
                        <span className="text-xs font-semibold text-stone-400">✅ Đã nhận</span>
                      ) : a.completed ? (
                        <button onClick={() => void claim(a)} disabled={claiming === a.id} className={btnPrimary}>
                          {claiming === a.id ? 'Đang nhận...' : '🎁 Nhận thưởng'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Tab Danh hiệu ---------------- */

export function TitlePanel({ userId }: { userId: string }) {
  const [titles, setTitles] = useState<MyTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setTitles(await getMyTitles(userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const equip = async (t: MyTitle) => {
    if (t.equipped) return;
    setEquipping(t.id);
    try {
      await equipTitle(userId, t.id);
      toast(`👑 Đã đeo danh hiệu: ${t.name}`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Đeo danh hiệu thất bại.');
    } finally {
      setEquipping(null);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">Đang tải danh hiệu...</p>;
  }
  if (titles.length === 0) {
    return (
      <p className="py-8 text-center text-sm italic text-stone-500 dark:text-stone-400">
        Chưa có danh hiệu nào. Hoàn thành thành tựu hoặc tăng cấp tu vi để nhận nhé!
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {titles.map((t) => {
        return (
          <div key={t.id} className={`${card} flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <span
                className={`user-title ${titleAnimClass(t.animation)}`}
                style={titleStyle(t)}
              >
                {t.name}
              </span>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {t.created_from === 'rank' ? '⚔️ Thăng cấp tu vi' : '🏅 Thành tựu'} · nhận{' '}
                {new Date(t.earned_at).toLocaleDateString('vi-VN')}
              </p>
            </div>
            {t.equipped ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                ✨ Đang đeo
              </span>
            ) : (
              <button onClick={() => void equip(t)} disabled={equipping === t.id} className={btnGhost}>
                {equipping === t.id ? '...' : 'Đeo'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

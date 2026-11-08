import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  claimAchievement,
  claimQuest,
  ensureQuestRows,
  ensureRankTitles,
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
import { CheckIcon, GemIcon } from './icons';

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: 'var(--brand)' }}
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
  { id: 'daily', label: 'Hàng ngày' },
  { id: 'weekly', label: 'Hàng tuần' },
  { id: 'monthly', label: 'Hàng tháng' },
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
      toast(`Nhận ${reward} linh thạch từ "${q.name}"!`);
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
        {PERIODS.map((p) => {
          const active = period === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition"
              style={
                active
                  ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                  : { background: 'var(--surface-alt)', color: 'var(--ink)', borderColor: 'var(--border)' }
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {loading ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Đang tải nhiệm vụ...
        </p>
      ) : quests.length === 0 ? (
        <p className="py-8 text-center text-sm italic" style={{ color: 'var(--muted)' }}>
          Chưa có nhiệm vụ nào cho kỳ này.
        </p>
      ) : (
        quests.map((q) => (
          <div
            key={q.id}
            className="rounded-2xl border p-4 shadow-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold" style={{ color: 'var(--ink)' }}>
                  {q.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {q.description}
                </p>
              </div>
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
              >
                <GemIcon className="h-3 w-3" /> {q.reward_stones}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <ProgressBar value={q.progress} max={q.target_value} />
              </div>
              <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                {fmtProgress(q.target_type, Math.min(q.progress, q.target_value))} /{' '}
                {fmtTarget(q.target_type, q.target_value)}
              </span>
            </div>
            <div className="mt-3">
              {q.claimed ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  <CheckIcon className="h-3.5 w-3.5" /> Đã nhận thưởng
                </span>
              ) : q.completed ? (
                <button
                  onClick={() => void claim(q)}
                  disabled={claiming === q.id}
                  className="cursor-pointer rounded-full px-4 py-1.5 text-xs font-bold text-white"
                  style={{ background: 'var(--brand)' }}
                >
                  {claiming === q.id ? 'Đang nhận...' : 'Nhận thưởng'}
                </button>
              ) : (
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Chưa hoàn thành
                </span>
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
  { id: 'reading', label: 'Đọc truyện' },
  { id: 'cultivation', label: 'Tu vi' },
  { id: 'wealth', label: 'Tài phú' },
  { id: 'collection', label: 'Sưu tầm' },
  { id: 'streak', label: 'Kiên trì' },
  { id: 'explore', label: 'Khám phá' },
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
      toast(`Nhận ${reward} linh thạch từ "${a.name}"!`);
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
    return CATEGORIES.map((c) => ({ ...c, items: g.get(c.id) ?? [] })).filter(
      (c) => c.items.length > 0,
    );
  }, [achs]);

  const doneCount = achs.filter((a) => a.completed).length;

  if (loading) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
        Đang tải thành tựu...
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Đã mở khóa{' '}
        <strong style={{ color: 'var(--brand)' }}>
          {doneCount}/{achs.length}
        </strong>{' '}
        thành tựu
      </p>
      {grouped.map((g) => (
        <div key={g.id}>
          <p className="font-display mb-2.5 text-lg font-bold" style={{ color: 'var(--ink)' }}>
            {g.label}
          </p>
          <div className="space-y-2.5">
            {g.items.map((a) => (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 shadow-sm ${a.completed ? '' : 'opacity-80'}`}
                style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
                    style={{ background: 'var(--surface-alt)' }}
                  >
                    {a.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold" style={{ color: 'var(--ink)' }}>
                      {a.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {a.description}
                    </p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1">
                        <ProgressBar value={a.progress} max={a.target_value} />
                      </div>
                      <span className="shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
                        {fmtProgress(a.target_type, Math.min(a.progress, a.target_value))} /{' '}
                        {fmtTarget(a.target_type, a.target_value)}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
                      >
                        <GemIcon className="h-3 w-3" /> {a.reward_stones}
                      </span>
                      {a.reward_title_code && (
                        <span className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                          + Danh hiệu
                        </span>
                      )}
                      {a.claimed ? (
                        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                          Đã nhận
                        </span>
                      ) : a.completed ? (
                        <button
                          onClick={() => void claim(a)}
                          disabled={claiming === a.id}
                          className="cursor-pointer rounded-full px-4 py-1 text-xs font-bold text-white"
                          style={{ background: 'var(--brand)' }}
                        >
                          {claiming === a.id ? 'Đang nhận...' : 'Nhận thưởng'}
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
  const [healed, setHealed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setTitles(await getMyTitles(userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && titles.length === 0 && !healed) {
      setHealed(true);
      (async () => {
        await ensureRankTitles(userId);
        setTitles(await getMyTitles(userId));
      })();
    }
  }, [loading, titles.length, healed, userId]);

  const retry = async () => {
    setLoading(true);
    const r = await ensureRankTitles(userId);
    const list = await getMyTitles(userId);
    setTitles(list);
    setLoading(false);
    if (list.length === 0) {
      alert(`Chẩn đoán: ${r.detail}`);
    } else {
      toast(`Đã nhận ${list.length} danh hiệu!`);
    }
  };

  const equip = async (t: MyTitle) => {
    if (t.equipped) return;
    setEquipping(t.id);
    try {
      await equipTitle(userId, t.id);
      toast(`Đã đeo danh hiệu: ${t.name}`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Đeo danh hiệu thất bại.');
    } finally {
      setEquipping(null);
    }
  };

  if (loading) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
        Đang tải danh hiệu...
      </p>
    );
  }
  if (titles.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm italic" style={{ color: 'var(--muted)' }}>
          Chưa có danh hiệu nào. Hoàn thành thành tựu hoặc tăng cấp tu vi để nhận!
        </p>
        <button
          onClick={() => void retry()}
          className="mt-3 cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--brand)' }}
        >
          Kiểm tra lại danh hiệu
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {titles.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
        >
          <div className="min-w-0">
            <span className={`user-title ${titleAnimClass(t.animation)}`} style={titleStyle(t)}>
              {t.name}
            </span>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {t.created_from === 'rank' ? 'Thăng cấp tu vi' : 'Thành tựu'} • nhận{' '}
              {new Date(t.earned_at).toLocaleDateString('vi-VN')}
            </p>
          </div>
          {t.equipped ? (
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
            >
              Đang đeo
            </span>
          ) : (
            <button
              onClick={() => void equip(t)}
              disabled={equipping === t.id}
              className="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition hover:opacity-80"
              style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
            >
              {equipping === t.id ? '...' : 'Trang bị'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

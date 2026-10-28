import { getSupabase } from './supabase';
import { getRank } from './tuvi';

/**
 * Gamification: nhiệm vụ ngày/tuần/tháng, thành tựu, danh hiệu.
 * Mọi hàm đều bọc try/catch — lỗi mạng không bao giờ làm crash app.
 */

export type Period = 'daily' | 'weekly' | 'monthly';
export type StatMode = 'inc' | 'set' | 'max';

/** Gửi toast toàn cục (ToastHost trong App.tsx sẽ hiển thị). */
export function toast(msg: string): void {
  try {
    window.dispatchEvent(new CustomEvent('mt-toast', { detail: { msg } }));
  } catch {
    /* bỏ qua */
  }
}

/** Khóa kỳ cho nhiệm vụ (dùng UTC): daily → YYYY-MM-DD, weekly → YYYY-Www (ISO), monthly → YYYY-MM. */
export function periodKey(period: Period, d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  if (period === 'daily') return `${y}-${m}-${String(d.getUTCDate()).padStart(2, '0')}`;
  if (period === 'monthly') return `${y}-${m}`;
  // ISO week: thứ 5 của tuần quyết định năm/tuần
  const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7; // Thứ 2 = 0
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((tmp.getTime() - firstThu.getTime()) / (7 * 864e5));
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

interface QuestDef {
  id: string;
  name: string;
  period: Period;
  target_value: number;
}

interface AchDef {
  id: string;
  name: string;
  target_value: number;
}

/** Tạo dòng quest_progress cho mọi quest đang bật ở kỳ hiện tại (nếu chưa có). */
export async function ensureQuestRows(userId: string): Promise<void> {
  try {
    const sb = getSupabase();
    const { data: quests } = await sb
      .from('quests')
      .select('id, period')
      .eq('is_active', true);
    if (!quests || quests.length === 0) return;
    const rows = (quests as { id: string; period: Period }[]).map((q) => ({
      user_id: userId,
      quest_id: q.id,
      period_key: periodKey(q.period),
    }));
    await sb
      .from('quest_progress')
      .upsert(rows, { onConflict: 'user_id,quest_id,period_key', ignoreDuplicates: true });
  } catch {
    /* bỏ qua */
  }
}

/**
 * Cộng chỉ số cho quest + achievement cùng target_type.
 * mode: 'inc' cộng dồn | 'set' gán | 'max' lấy lớn nhất.
 */
export async function bumpStat(
  userId: string,
  targetType: string,
  amount: number,
  mode: StatMode = 'inc',
): Promise<void> {
  try {
    const sb = getSupabase();

    // --- Nhiệm vụ ---
    const { data: quests } = await sb
      .from('quests')
      .select('id, name, period, target_value')
      .eq('is_active', true)
      .eq('target_type', targetType);
    const qdefs = (quests ?? []) as QuestDef[];
    if (qdefs.length > 0) {
      await ensureQuestRows(userId);
      const { data: progs } = await sb
        .from('quest_progress')
        .select('quest_id, period_key, progress, completed, claimed')
        .eq('user_id', userId)
        .in(
          'quest_id',
          qdefs.map((q) => q.id),
        );
      const pmap = new Map(
        ((progs ?? []) as { quest_id: string; period_key: string; progress: number; completed: boolean; claimed: boolean }[]).map(
          (p) => [`${p.quest_id}:${p.period_key}`, p],
        ),
      );
      for (const q of qdefs) {
        const pk = periodKey(q.period);
        const prog = pmap.get(`${q.id}:${pk}`);
        if (!prog || prog.claimed) continue;
        const np =
          mode === 'max'
            ? Math.max(prog.progress, amount)
            : mode === 'set'
              ? amount
              : prog.progress + amount;
        const done = np >= q.target_value;
        await sb
          .from('quest_progress')
          .update({ progress: np, completed: done || prog.completed, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('quest_id', q.id)
          .eq('period_key', pk);
        if (done && !prog.completed) toast(`🎯 Hoàn thành nhiệm vụ: ${q.name}`);
      }
    }

    // --- Thành tựu ---
    const { data: achs } = await sb
      .from('achievements')
      .select('id, name, target_value')
      .eq('is_active', true)
      .eq('target_type', targetType);
    const adefs = (achs ?? []) as AchDef[];
    if (adefs.length > 0) {
      await sb
        .from('user_achievements')
        .upsert(
          adefs.map((a) => ({ user_id: userId, achievement_id: a.id })),
          { onConflict: 'user_id,achievement_id', ignoreDuplicates: true },
        );
      const { data: uas } = await sb
        .from('user_achievements')
        .select('achievement_id, progress, completed, claimed')
        .eq('user_id', userId)
        .in(
          'achievement_id',
          adefs.map((a) => a.id),
        );
      const umap = new Map(
        ((uas ?? []) as { achievement_id: string; progress: number; completed: boolean; claimed: boolean }[]).map(
          (u) => [u.achievement_id, u],
        ),
      );
      for (const a of adefs) {
        const ua = umap.get(a.id);
        if (!ua || ua.claimed) continue;
        const np =
          mode === 'max'
            ? Math.max(ua.progress, amount)
            : mode === 'set'
              ? amount
              : ua.progress + amount;
        const done = np >= a.target_value;
        const upd: Record<string, unknown> = {
          progress: np,
          completed: done || ua.completed,
        };
        if (done && !ua.completed) upd.completed_at = new Date().toISOString();
        await sb
          .from('user_achievements')
          .update(upd)
          .eq('user_id', userId)
          .eq('achievement_id', a.id);
        if (done && !ua.completed) toast(`🏅 Mở khóa thành tựu: ${a.name}`);
      }
    }
  } catch {
    /* bỏ qua */
  }
}

/** Đồng bộ các chỉ số "trạng thái" từ DB hiện tại (gọi khi mở Profile, mua đồ, thêm tủ, đổi avatar). */
export async function syncStateStats(userId: string): Promise<void> {
  // trao bù danh hiệu rank CHẠY RIÊNG — không để lỗi ở các bước khác làm mất
  try {
    await ensureRankTitles(userId);
  } catch {
    /* bỏ qua */
  }
  try {
    const sb = getSupabase();
    const { data: prof } = await sb
      .from('profiles')
      .select('reading_seconds, spirit_stones, avatar_url')
      .eq('id', userId)
      .single();
    if (prof) {
      const p = prof as { reading_seconds: number; spirit_stones: number; avatar_url: string | null };
      await bumpStat(userId, 'stones_owned_max', p.spirit_stones, 'max');
      await bumpStat(userId, 'avatar_set', p.avatar_url ? 1 : 0, 'set');
      await bumpStat(userId, 'rank_index', getRank(p.reading_seconds / 3600).index, 'set');
    }
    const { count: novels } = await sb
      .from('reading_progress')
      .select('novel_id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (novels != null) await bumpStat(userId, 'novels_read', novels, 'set');
    const { count: shelf } = await sb
      .from('bookshelf')
      .select('novel_id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (shelf != null) await bumpStat(userId, 'bookshelf_count', shelf, 'set');
    const { data: items } = await sb.from('inventory_items').select('item_id').eq('user_id', userId);
    const ids = ((items ?? []) as { item_id: string }[]).map((i) => i.item_id);
    if (ids.length > 0) {
      const { data: cos } = await sb.from('cosmetic_items').select('type').in('id', ids);
      const list = (cos ?? []) as { type: string }[];
      await bumpStat(userId, 'frames_owned', list.filter((c) => c.type === 'frame').length, 'set');
      await bumpStat(userId, 'treasures_owned', list.filter((c) => c.type === 'treasure').length, 'set');
    } else {
      await bumpStat(userId, 'frames_owned', 0, 'set');
      await bumpStat(userId, 'treasures_owned', 0, 'set');
    }
  } catch {
    /* bỏ qua */
  }
}

/** Điểm danh: cập nhật chuỗi ngày đăng nhập liên tiếp (gọi khi session sẵn sàng). */
export async function touchLogin(userId: string): Promise<void> {
  try {
    const sb = getSupabase();
    const { data: prof } = await sb
      .from('profiles')
      .select('last_active_date, login_streak')
      .eq('id', userId)
      .single();
    if (!prof) return;
    const today = periodKey('daily');
    const last = (prof as { last_active_date: string | null }).last_active_date;
    if (last === today) return; // đã điểm danh hôm nay
    const y = new Date();
    y.setUTCDate(y.getUTCDate() - 1);
    const yesterday = periodKey('daily', y);
    const streak = last === yesterday ? ((prof as { login_streak: number }).login_streak ?? 0) + 1 : 1;
    await sb.from('profiles').update({ last_active_date: today, login_streak: streak }).eq('id', userId);
    await bumpStat(userId, 'login_streak', streak, 'set');
  } catch {
    /* bỏ qua */
  }
}

/** Trao bù danh hiệu rank cho cấp hiện tại (user cũ đã tu luyện từ trước) —
 * lặng lẽ, không đổi danh hiệu đang đeo (trừ khi chưa đeo cái nào).
 * Trả về chẩn đoán để hiển thị khi cần debug. */
export async function ensureRankTitles(
  userId: string,
): Promise<{ granted: number; detail: string }> {
  const fail = (detail: string) => {
    console.warn('[gamification] ensureRankTitles:', detail);
    return { granted: 0, detail };
  };
  try {
    const sb = getSupabase();
    const { data: prof, error: pErr } = await sb
      .from('profiles')
      .select('reading_seconds')
      .eq('id', userId)
      .single();
    if (pErr) return fail(`Lỗi đọc profiles: ${pErr.message}`);
    if (!prof) return fail('Không tìm thấy hồ sơ user');
    const idx = getRank((prof as { reading_seconds: number }).reading_seconds / 3600).index;
    const { data: titles, error: tErr } = await sb
      .from('titles')
      .select('id, code')
      .like('code', 'rank_%')
      .eq('is_active', true);
    if (tErr) return fail(`Lỗi đọc bảng titles: ${tErr.message}`);
    const list = (titles ?? []) as { id: string; code: string }[];
    if (list.length === 0)
      return fail('Bảng titles đang trống — chưa chạy seed danh hiệu trong migration');
    const wanted = new Set(Array.from({ length: idx + 1 }, (_, i) => `rank_${i}`));
    const rows = list
      .filter((t) => wanted.has(t.code))
      .map((t) => ({ user_id: userId, title_id: t.id }));
    if (rows.length === 0) return fail('Không tìm thấy danh hiệu rank phù hợp');
    const { error: uErr } = await sb
      .from('user_titles')
      .upsert(rows, { onConflict: 'user_id,title_id', ignoreDuplicates: true });
    if (uErr) return fail(`Không ghi được vào user_titles (RLS?): ${uErr.message}`);
    // nếu chưa đeo danh hiệu nào thì đeo luôn cái cao nhất
    const { count } = await sb
      .from('user_titles')
      .select('title_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('equipped', true);
    if (count === 0) {
      const top = list.find((t) => t.code === `rank_${idx}`);
      if (top) {
        await sb
          .from('user_titles')
          .update({ equipped: true })
          .eq('user_id', userId)
          .eq('title_id', top.id);
      }
    }
    const detail = `Đã trao ${rows.length} danh hiệu rank (cấp ${idx})`;
    console.info('[gamification] ensureRankTitles:', detail);
    return { granted: rows.length, detail };
  } catch (e) {
    return fail(`Lỗi không ngờ: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Trao danh hiệu theo code — tự động đeo danh hiệu mới nhất. */
export async function grantTitle(userId: string, code: string): Promise<void> {
  try {
    const sb = getSupabase();
    const { data: t } = await sb
      .from('titles')
      .select('id, name')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();
    if (!t) return;
    const title = t as { id: string; name: string };
    await sb
      .from('user_titles')
      .upsert({ user_id: userId, title_id: title.id }, { onConflict: 'user_id,title_id', ignoreDuplicates: true });
    // đeo danh hiệu mới nhất, gỡ các cái cũ
    await sb.from('user_titles').update({ equipped: false }).eq('user_id', userId);
    await sb.from('user_titles').update({ equipped: true }).eq('user_id', userId).eq('title_id', title.id);
    toast(`👑 Danh hiệu mới: ${title.name}`);
  } catch {
    /* bỏ qua */
  }
}

/** Kiểm tra tăng cấp tu vi → trao danh hiệu các cấp đã vượt qua. */
export async function checkRankUp(userId: string, oldSeconds: number, newSeconds: number): Promise<void> {
  const oldIdx = getRank(oldSeconds / 3600).index;
  const newIdx = getRank(newSeconds / 3600).index;
  if (newIdx <= oldIdx) return;
  for (let i = oldIdx + 1; i <= newIdx; i++) {
    await grantTitle(userId, `rank_${i}`);
  }
}

/** Nhận thưởng nhiệm vụ → trả về số linh thạch nhận được. */
export async function claimQuest(userId: string, questId: string): Promise<number> {
  const sb = getSupabase();
  const { data: q } = await sb
    .from('quests')
    .select('period, reward_stones, name')
    .eq('id', questId)
    .single();
  if (!q) throw new Error('Không tìm thấy nhiệm vụ.');
  const quest = q as { period: Period; reward_stones: number; name: string };
  const pk = periodKey(quest.period);
  const { data: prog } = await sb
    .from('quest_progress')
    .select('progress, completed, claimed')
    .eq('user_id', userId)
    .eq('quest_id', questId)
    .eq('period_key', pk)
    .maybeSingle();
  const p = prog as { completed: boolean; claimed: boolean } | null;
  if (!p || !p.completed) throw new Error('Nhiệm vụ chưa hoàn thành.');
  if (p.claimed) throw new Error('Đã nhận thưởng rồi.');
  const { error: uErr } = await sb
    .from('quest_progress')
    .update({ claimed: true })
    .eq('user_id', userId)
    .eq('quest_id', questId)
    .eq('period_key', pk);
  if (uErr) throw new Error(`Nhận thưởng thất bại: ${uErr.message}`);
  const { data: prof } = await sb.from('profiles').select('spirit_stones').eq('id', userId).single();
  const stones = ((prof as { spirit_stones: number } | null)?.spirit_stones ?? 0) + quest.reward_stones;
  await sb.from('profiles').update({ spirit_stones: stones }).eq('id', userId);
  await bumpStat(userId, 'stones_earned', quest.reward_stones);
  await bumpStat(userId, 'quests_claimed', 1);
  if (quest.period === 'daily') await bumpStat(userId, 'daily_quests_done', 1);
  return quest.reward_stones;
}

/** Nhận thưởng thành tựu → trả về số linh thạch nhận được. */
export async function claimAchievement(userId: string, achievementId: string): Promise<number> {
  const sb = getSupabase();
  const { data: a } = await sb
    .from('achievements')
    .select('reward_stones, reward_title_code, name')
    .eq('id', achievementId)
    .single();
  if (!a) throw new Error('Không tìm thấy thành tựu.');
  const ach = a as { reward_stones: number; reward_title_code: string | null; name: string };
  const { data: ua } = await sb
    .from('user_achievements')
    .select('completed, claimed')
    .eq('user_id', userId)
    .eq('achievement_id', achievementId)
    .maybeSingle();
  const u = ua as { completed: boolean; claimed: boolean } | null;
  if (!u || !u.completed) throw new Error('Thành tựu chưa hoàn thành.');
  if (u.claimed) throw new Error('Đã nhận thưởng rồi.');
  const { error: uErr } = await sb
    .from('user_achievements')
    .update({ claimed: true })
    .eq('user_id', userId)
    .eq('achievement_id', achievementId);
  if (uErr) throw new Error(`Nhận thưởng thất bại: ${uErr.message}`);
  const { data: prof } = await sb.from('profiles').select('spirit_stones').eq('id', userId).single();
  const stones = ((prof as { spirit_stones: number } | null)?.spirit_stones ?? 0) + ach.reward_stones;
  await sb.from('profiles').update({ spirit_stones: stones }).eq('id', userId);
  await bumpStat(userId, 'stones_earned', ach.reward_stones);
  await bumpStat(userId, 'achievements_unlocked', 1);
  if (ach.reward_title_code) await grantTitle(userId, ach.reward_title_code);
  return ach.reward_stones;
}

/** Đeo danh hiệu (gỡ các danh hiệu khác). */
export async function equipTitle(userId: string, titleId: string): Promise<void> {
  const sb = getSupabase();
  await sb.from('user_titles').update({ equipped: false }).eq('user_id', userId);
  const { error } = await sb
    .from('user_titles')
    .update({ equipped: true })
    .eq('user_id', userId)
    .eq('title_id', titleId);
  if (error) throw new Error(`Đeo danh hiệu thất bại: ${error.message}`);
}

/* ---------------- Đọc dữ liệu cho UI ---------------- */

export interface QuestView {
  id: string;
  code: string;
  name: string;
  description: string;
  period: Period;
  target_type: string;
  target_value: number;
  reward_stones: number;
  sort_order: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export async function getQuestsWithProgress(userId: string, period: Period): Promise<QuestView[]> {
  try {
    const sb = getSupabase();
    const { data: quests } = await sb
      .from('quests')
      .select('*')
      .eq('is_active', true)
      .eq('period', period)
      .order('sort_order');
    const list = (quests ?? []) as Omit<QuestView, 'progress' | 'completed' | 'claimed'>[];
    if (list.length === 0) return [];
    const pk = periodKey(period);
    const { data: progs } = await sb
      .from('quest_progress')
      .select('quest_id, progress, completed, claimed')
      .eq('user_id', userId)
      .eq('period_key', pk)
      .in(
        'quest_id',
        list.map((q) => q.id),
      );
    const pmap = new Map(
      ((progs ?? []) as { quest_id: string; progress: number; completed: boolean; claimed: boolean }[]).map(
        (p) => [p.quest_id, p],
      ),
    );
    return list.map((q) => {
      const p = pmap.get(q.id);
      return { ...q, progress: p?.progress ?? 0, completed: p?.completed ?? false, claimed: p?.claimed ?? false };
    });
  } catch {
    return [];
  }
}

export interface AchievementView {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  target_type: string;
  target_value: number;
  reward_stones: number;
  reward_title_code: string | null;
  icon: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export async function getAchievementsWithProgress(userId: string): Promise<AchievementView[]> {
  try {
    const sb = getSupabase();
    const { data: achs } = await sb.from('achievements').select('*').eq('is_active', true).order('target_value');
    const list = (achs ?? []) as Omit<AchievementView, 'progress' | 'completed' | 'claimed'>[];
    if (list.length === 0) return [];
    const { data: uas } = await sb
      .from('user_achievements')
      .select('achievement_id, progress, completed, claimed')
      .eq('user_id', userId)
      .in(
        'achievement_id',
        list.map((a) => a.id),
      );
    const umap = new Map(
      ((uas ?? []) as { achievement_id: string; progress: number; completed: boolean; claimed: boolean }[]).map(
        (u) => [u.achievement_id, u],
      ),
    );
    return list.map((a) => {
      const u = umap.get(a.id);
      return {
        ...a,
        progress: u?.progress ?? 0,
        completed: u?.completed ?? false,
        claimed: u?.claimed ?? false,
      };
    });
  } catch {
    return [];
  }
}

export interface TitleRow {
  id: string;
  code: string;
  name: string;
  color: string;
  glow: string;
  animation: string;
  created_from: string;
}

export interface MyTitle extends TitleRow {
  earned_at: string;
  equipped: boolean;
}

export async function getMyTitles(userId: string): Promise<MyTitle[]> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('user_titles')
      .select('earned_at, equipped, titles!inner(id, code, name, color, glow, animation, created_from)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });
    return ((data ?? []) as unknown as { earned_at: string; equipped: boolean; titles: TitleRow }[])
      .map((r) => ({ ...(r.titles as TitleRow), earned_at: r.earned_at, equipped: r.equipped }))
      .filter((t) => !!t.id);
  } catch {
    return [];
  }
}

export interface EquippedTitle extends TitleRow {
  user_id: string;
}

/** Danh hiệu đang đeo của 1 user (dùng cho UserTitle). */
export async function getEquippedTitle(userId: string): Promise<TitleRow | null> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('user_titles')
      .select('titles!inner(id, code, name, color, glow, animation, created_from)')
      .eq('user_id', userId)
      .eq('equipped', true)
      .maybeSingle();
    const row = data as unknown as { titles: TitleRow } | null;
    return row?.titles ?? null;
  } catch {
    return null;
  }
}

/** Map user_id → danh hiệu đang đeo (dùng cho BXH, 1 query). */
export async function getEquippedTitlesMap(userIds: string[]): Promise<Record<string, TitleRow>> {
  const map: Record<string, TitleRow> = {};
  if (userIds.length === 0) return map;
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('user_titles')
      .select('user_id, titles!inner(id, code, name, color, glow, animation, created_from)')
      .eq('equipped', true)
      .in('user_id', userIds);
    for (const r of (data ?? []) as unknown as { user_id: string; titles: TitleRow }[]) {
      if (r.titles?.id) map[r.user_id] = r.titles;
    }
  } catch {
    /* bỏ qua */
  }
  return map;
}

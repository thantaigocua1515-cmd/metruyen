import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchEquippedItems } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';
import { getRank, formatHours } from '../lib/tuvi';
import AvatarWithFrame from '../components/AvatarWithFrame';
import UserTitle from '../components/UserTitle';
import { QuestPanel, AchievementPanel, TitlePanel } from '../components/GamificationPanels';
import { syncStateStats } from '../lib/gamification';

type SubTab = 'quests' | 'achievements' | 'titles';

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'quests', label: '🎯 Nhiệm vụ' },
  { id: 'achievements', label: '🏅 Thành tựu' },
  { id: 'titles', label: '👑 Danh hiệu' },
];

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [frame, setFrame] = useState<EquippedItem | null>(null);
  const [treasure, setTreasure] = useState<EquippedItem | null>(null);
  const [shelfCount, setShelfCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('quests');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchEquippedItems(user.id).then(({ frame: f, treasure: t }) => {
      setFrame(f);
      setTreasure(t);
    });
    getSupabase()
      .from('bookshelf')
      .select('novel_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setShelfCount(count ?? 0));
    // Đồng bộ chỉ số thành tựu/nhiệm vụ từ trạng thái hiện tại
    void syncStateStats(user.id);
  }, [user, profile?.avatar_url]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      alert('Chỉ chấp nhận file ảnh.');
      return;
    }
    setUploading(true);
    try {
      const supabase = getSupabase();
      const path = `${user.id}/avatar.png`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const { error: uErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);
      if (uErr) throw uErr;
      await refreshProfile();
      void syncStateStats(user.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload avatar thất bại.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!user || !profile) {
    return (
      <p className="py-16 text-center text-stone-500 dark:text-stone-400">
        Hãy <Link to="/auth" className="text-amber-700 underline dark:text-amber-300">đăng nhập</Link> để
        xem trang cá nhân.
      </p>
    );
  }

  const rank = getRank(profile.reading_seconds / 3600);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-2xl border border-amber-900/15 bg-white p-6 shadow-sm dark:border-amber-100/10 dark:bg-stone-900">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <AvatarWithFrame
              src={profile.avatar_url}
              frame={frame}
              treasure={treasure}
              size={120}
              username={profile.username}
            />
            <UserTitle userId={user.id} />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onFile(e)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-full border border-amber-700 px-4 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-300 dark:hover:bg-stone-800"
            >
              {uploading ? 'Đang tải...' : '📷 Đổi avatar'}
            </button>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="font-display text-2xl font-bold text-amber-950 dark:text-amber-100">
              {profile.username}
            </h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {profile.role === 'admin' ? '👑 Quản trị viên' : '📖 Đạo hữu'} · tham gia{' '}
              {new Date(profile.created_at).toLocaleDateString('vi-VN')}
            </p>

            <div className="mt-4 rounded-xl bg-amber-50 p-4 dark:bg-stone-800">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold text-amber-800 dark:text-amber-300">
                  ⚔️ {rank.name}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {rank.nextName ? `→ ${rank.nextName}: ${Math.round(rank.progress)}%` : 'Đã đạt đỉnh!'}
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 transition-all"
                  style={{ width: `${rank.progress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
                <p className="text-lg font-bold text-amber-800 dark:text-amber-300">
                  {formatHours(profile.reading_seconds)}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Giờ đọc</p>
              </div>
              <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
                <p className="text-lg font-bold text-amber-800 dark:text-amber-300">
                  💎 {profile.spirit_stones}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Linh thạch</p>
              </div>
              <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
                <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{shelfCount}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Truyện trong tủ</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nhiệm vụ / Thành tựu / Danh hiệu */}
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${
              subTab === t.id
                ? 'bg-amber-700 text-white dark:bg-amber-600'
                : 'border border-amber-700/40 text-amber-800 dark:border-amber-500/40 dark:text-amber-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {subTab === 'quests' && <QuestPanel userId={user.id} />}
        {subTab === 'achievements' && <AchievementPanel userId={user.id} />}
        {subTab === 'titles' && <TitlePanel userId={user.id} />}
      </div>
    </div>
  );
}

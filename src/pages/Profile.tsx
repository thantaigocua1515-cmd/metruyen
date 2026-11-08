import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';
import { fetchEquippedItems } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';
import { getRank, formatHours } from '../lib/tuvi';
import AvatarWithFrame from '../components/AvatarWithFrame';
import UserTitle from '../components/UserTitle';
import { QuestPanel, AchievementPanel, TitlePanel } from '../components/GamificationPanels';
import { syncStateStats } from '../lib/gamification';
import { BookmarkIcon, ClockIcon, GemIcon, SparklesIcon } from '../components/icons';

type SubTab = 'quests' | 'achievements' | 'titles';

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'quests', label: 'Nhiệm vụ tu luyện' },
  { id: 'achievements', label: 'Thành tựu' },
  { id: 'titles', label: 'Danh hiệu' },
];

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const { template } = useTemplate();
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
      <p className="py-20 text-center" style={{ color: 'var(--muted)' }}>
        Hãy{' '}
        <Link to="/auth" className="font-bold underline" style={{ color: 'var(--brand)' }}>
          đăng nhập
        </Link>{' '}
        để xem trang cá nhân.
      </p>
    );
  }

  const rank = getRank(profile.reading_seconds / 3600);
  const isSwiss = template === 'toi-gian';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div
        className={`border p-6 shadow-sm sm:p-8 ${isSwiss ? '' : 'rounded-3xl'}`}
        style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
      >
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2.5">
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
              className={`cursor-pointer border px-4 py-1.5 text-xs font-semibold transition hover:opacity-80 ${
                isSwiss ? '' : 'rounded-full'
              }`}
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface-alt)',
                color: 'var(--ink)',
              }}
            >
              {uploading ? 'Đang tải...' : 'Đổi ảnh đại diện'}
            </button>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-display text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
                {profile.username}
              </h1>
              <span
                className="rounded-full px-3 py-0.5 text-xs font-bold"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
              >
                {profile.role === 'admin' ? 'Quản trị viên' : 'Đạo hữu'}
              </span>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              Nhập môn ngày {new Date(profile.created_at).toLocaleDateString('vi-VN')}
            </p>

            {/* Realm Progress */}
            <div
              className={`mt-5 border p-4 ${isSwiss ? '' : 'rounded-2xl'}`}
              style={{ borderColor: 'var(--border)', background: 'var(--surface-alt)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display flex items-center gap-1.5 text-lg font-bold" style={{ color: 'var(--brand)' }}>
                  <SparklesIcon className="h-4 w-4" />
                  Cảnh giới: {rank.name}
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {rank.nextName ? `Đột phá ${rank.nextName}: ${Math.round(rank.progress)}%` : 'Cảnh giới tối cao'}
                </span>
              </div>
              <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${rank.progress}%`,
                    background: 'linear-gradient(90deg, var(--brand), var(--accent, var(--brand-strong)))',
                  }}
                />
              </div>
            </div>

            {/* Stats Bento */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div
                className={`border p-3.5 ${isSwiss ? '' : 'rounded-2xl'}`}
                style={{ borderColor: 'var(--border)', background: 'var(--surface-alt)' }}
              >
                <p className="inline-flex items-center gap-1 text-lg font-bold" style={{ color: 'var(--brand)' }}>
                  <ClockIcon className="h-4 w-4" />
                  {formatHours(profile.reading_seconds)}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                  Giờ tu luyện
                </p>
              </div>
              <div
                className={`border p-3.5 ${isSwiss ? '' : 'rounded-2xl'}`}
                style={{ borderColor: 'var(--border)', background: 'var(--surface-alt)' }}
              >
                <p className="inline-flex items-center gap-1 text-lg font-bold" style={{ color: 'var(--brand)' }}>
                  <GemIcon className="h-4 w-4" />
                  {profile.spirit_stones}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                  Linh thạch
                </p>
              </div>
              <div
                className={`border p-3.5 ${isSwiss ? '' : 'rounded-2xl'}`}
                style={{ borderColor: 'var(--border)', background: 'var(--surface-alt)' }}
              >
                <p className="inline-flex items-center gap-1 text-lg font-bold" style={{ color: 'var(--brand)' }}>
                  <BookmarkIcon className="h-4 w-4" />
                  {shelfCount}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                  Truyện trong tủ
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {SUBTABS.map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`shrink-0 cursor-pointer border px-5 py-2 text-sm font-bold transition ${
                isSwiss ? 'font-mono-tech uppercase' : 'rounded-full'
              }`}
              style={
                active
                  ? {
                      background: 'var(--brand)',
                      color: '#fff',
                      borderColor: 'var(--brand)',
                    }
                  : {
                      background: 'var(--card-bg)',
                      color: 'var(--ink)',
                      borderColor: 'var(--border)',
                    }
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {subTab === 'quests' && <QuestPanel userId={user.id} />}
        {subTab === 'achievements' && <AchievementPanel userId={user.id} />}
        {subTab === 'titles' && <TitlePanel userId={user.id} />}
      </div>
    </div>
  );
}

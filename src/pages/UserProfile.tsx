import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { getRank, formatHours } from '../lib/tuvi';
import { fetchEquippedItems } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';
import AvatarWithFrame from '../components/AvatarWithFrame';
import UserTitle from '../components/UserTitle';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';
import { ArrowLeftIcon, ClockIcon, GemIcon, SparklesIcon } from '../components/icons';

interface ProfileRow {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  reading_seconds: number;
  spirit_stones: number;
  created_at: string;
}

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { template } = useTemplate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [frame, setFrame] = useState<EquippedItem | null>(null);
  const [treasure, setTreasure] = useState<EquippedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) return;
      setLoading(true);
      setNotFound(false);
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from('profiles')
          .select('id,username,avatar_url,role,reading_seconds,spirit_stones,created_at')
          .eq('id', userId)
          .maybeSingle();
        if (error || !data) {
          if (alive) setNotFound(true);
          return;
        }
        const eq = await fetchEquippedItems(userId);
        if (alive) {
          setProfile(data as ProfileRow);
          setFrame(eq.frame);
          setTreasure(eq.treasure);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <p className="py-20 text-center" style={{ color: 'var(--muted)' }}>
        Đang mở hồ sơ đạo hữu...
      </p>
    );
  }
  if (notFound || !profile) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg" style={{ color: 'var(--muted)' }}>
          Không tìm thấy đạo hữu này.
        </p>
        <Link to="/leaderboard" className="mt-2 inline-block font-semibold underline" style={{ color: 'var(--brand)' }}>
          ← Về bảng xếp hạng
        </Link>
      </div>
    );
  }

  const rank = getRank(profile.reading_seconds / 3600);
  const isSelf = user?.id === profile.id;
  const joined = new Date(profile.created_at).toLocaleDateString('vi-VN');
  const isSwiss = template === 'toi-gian';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-4">
        <Link
          to="/leaderboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-75"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Về bảng xếp hạng
        </Link>
      </div>

      <div
        className={`border p-6 text-center shadow-sm sm:p-8 ${isSwiss ? '' : 'rounded-3xl'}`}
        style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
      >
        <div className="flex justify-center">
          <AvatarWithFrame
            src={profile.avatar_url}
            size={120}
            username={profile.username}
            frame={frame}
            treasure={treasure}
          />
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
          {profile.username}
        </h1>
        <div className="mt-1.5 flex justify-center">
          <UserTitle userId={profile.id} />
        </div>
        {profile.role === 'admin' && (
          <span
            className="mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
          >
            Quản trị viên
          </span>
        )}
        <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
          Gia nhập: {joined}
        </p>

        <div className="mx-auto mt-5 max-w-sm">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: 'var(--brand)' }}>
            <SparklesIcon className="h-4 w-4" />
            {rank.name}
            {rank.nextName && (
              <span className="font-normal" style={{ color: 'var(--muted)' }}>
                → {rank.nextName}
              </span>
            )}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${rank.progress}%`, background: 'var(--brand)' }}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-center">
          <div
            className={`border p-3.5 ${isSwiss ? '' : 'rounded-2xl'}`}
            style={{ borderColor: 'var(--border)', background: 'var(--surface-alt)' }}
          >
            <p className="inline-flex items-center gap-1 text-lg font-bold" style={{ color: 'var(--brand)' }}>
              <ClockIcon className="h-4 w-4" />
              {formatHours(profile.reading_seconds)}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Giờ đọc
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
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Linh thạch
            </p>
          </div>
        </div>

        {(frame || treasure) && (
          <div
            className={`mt-5 border p-4 text-left ${isSwiss ? '' : 'rounded-2xl'}`}
            style={{ borderColor: 'var(--border)', background: 'var(--surface-alt)' }}
          >
            <p className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--muted)' }}>
              Pháp bảo đang trang bị
            </p>
            {frame && (
              <p className="mt-1 truncate text-sm" style={{ color: 'var(--ink)' }}>
                Khung viền: <strong>{frame.name || 'Khung avatar'}</strong>
              </p>
            )}
            {treasure && (
              <p className="mt-0.5 truncate text-sm" style={{ color: 'var(--ink)' }}>
                Pháp bảo: <strong>{treasure.name || 'Pháp bảo'}</strong>
              </p>
            )}
          </div>
        )}

        {isSelf && (
          <Link
            to="/profile"
            className="mt-6 inline-flex h-10 items-center rounded-full px-6 text-sm font-bold text-white"
            style={{ background: 'var(--brand)' }}
          >
            Đây là bạn — tới trang cá nhân
          </Link>
        )}
      </div>
    </div>
  );
}

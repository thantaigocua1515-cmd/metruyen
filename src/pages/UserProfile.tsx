import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { getRank, formatHours } from '../lib/tuvi';
import { fetchEquippedItems } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';
import AvatarWithFrame from '../components/AvatarWithFrame';
import { useAuth } from '../context/AuthContext';

interface ProfileRow {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  reading_seconds: number;
  spirit_stones: number;
  created_at: string;
}

/** Trang cá nhân công khai của đạo hữu khác (xem từ BXH). */
export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
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
    return <p className="py-16 text-center text-stone-500 dark:text-stone-400">Đang mở hồ sơ...</p>;
  }
  if (notFound || !profile) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-stone-500 dark:text-stone-400">Không tìm thấy đạo hữu này.</p>
        <Link to="/leaderboard" className="mt-2 inline-block text-amber-700 underline dark:text-amber-300">
          ← Về bảng xếp hạng
        </Link>
      </div>
    );
  }

  const rank = getRank(profile.reading_seconds / 3600);
  const isSelf = user?.id === profile.id;
  const joined = new Date(profile.created_at).toLocaleDateString('vi-VN');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-2xl border border-amber-900/15 bg-white p-6 text-center shadow-sm dark:border-amber-100/10 dark:bg-stone-900">
        <div className="flex justify-center">
          <AvatarWithFrame
            src={profile.avatar_url}
            size={120}
            username={profile.username}
            frame={frame}
            treasure={treasure}
          />
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold text-amber-950 dark:text-amber-100">
          {profile.username}
        </h1>
        {profile.role === 'admin' && (
          <span className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            👑 Quản trị viên
          </span>
        )}
        <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">Gia nhập: {joined}</p>

        <div className="mx-auto mt-4 max-w-sm">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            ⚔️ {rank.name}
            {rank.nextName && <span className="font-normal text-stone-500"> → {rank.nextName}</span>}
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
              style={{ width: `${rank.progress}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-amber-50 p-3 dark:bg-stone-800">
            <p className="text-lg font-bold text-amber-800 dark:text-amber-300">
              {formatHours(profile.reading_seconds)}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">⏳ Giờ đọc</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 dark:bg-stone-800">
            <p className="text-lg font-bold text-amber-800 dark:text-amber-300">
              💎 {profile.spirit_stones}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Linh thạch</p>
          </div>
        </div>

        {(frame || treasure) && (
          <div className="mt-4 space-y-1 text-left">
            <p className="text-sm font-bold text-stone-700 dark:text-stone-200">✨ Đang trang bị</p>
            {frame && (
              <p className="truncate text-sm text-stone-600 dark:text-stone-300">
                🖼️ Khung: <span className="font-semibold">{frame.name || 'Khung avatar'}</span>
              </p>
            )}
            {treasure && (
              <p className="truncate text-sm text-stone-600 dark:text-stone-300">
                ⚔️ Pháp bảo: <span className="font-semibold">{treasure.name || 'Pháp bảo'}</span>
              </p>
            )}
          </div>
        )}

        {isSelf && (
          <Link
            to="/profile"
            className="mt-5 inline-block rounded-full bg-amber-700 px-5 py-1.5 text-sm font-semibold text-white hover:bg-amber-800 dark:bg-amber-600"
          >
            Đây là bạn — tới trang cá nhân
          </Link>
        )}
      </div>
      <div className="mt-4 text-center">
        <Link to="/leaderboard" className="text-sm text-amber-700 hover:underline dark:text-amber-300">
          ← Về bảng xếp hạng
        </Link>
      </div>
    </div>
  );
}

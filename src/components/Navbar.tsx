import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AvatarWithFrame from './AvatarWithFrame';
import { fetchEquippedItems } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';

export default function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [frame, setFrame] = useState<EquippedItem | null>(null);
  const [treasure, setTreasure] = useState<EquippedItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    if (!user) {
      setFrame(null);
      setTreasure(null);
      return;
    }
    fetchEquippedItems(user.id).then(({ frame: f, treasure: t }) => {
      setFrame(f);
      setTreasure(t);
    });
  }, [user, profile?.avatar_url]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    navigate(query ? `/?q=${encodeURIComponent(query)}` : '/');
  };

  const go = (to: string) => {
    setMenuOpen(false);
    navigate(to);
  };

  const doSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  };

  const menuItems: { label: string; to: string; adminOnly?: boolean }[] = [
    { label: '👤 Trang cá nhân', to: '/profile' },
    { label: '📚 Tủ truyện', to: '/bookshelf' },
    { label: '🎒 Túi trữ vật', to: '/inventory' },
    { label: '🏯 Tàng Bảo Các', to: '/treasury' },
    { label: '🏆 Bảng xếp hạng', to: '/leaderboard' },
    { label: '⚙️ Quản trị', to: '/admin', adminOnly: true },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-amber-900/20 bg-amber-50/90 backdrop-blur dark:border-amber-100/10 dark:bg-stone-950/90">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="text-2xl">📚</span>
          <span className="font-display text-xl font-bold text-amber-900 dark:text-amber-200">
            Mê Truyện
          </span>
        </Link>

        <form onSubmit={submitSearch} className="hidden flex-1 sm:block">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm truyện, tác giả..."
            className="w-full rounded-full border border-amber-900/20 bg-white px-4 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-amber-100/15 dark:bg-stone-900 dark:text-stone-100"
          />
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
            className="rounded-full p-2 text-lg hover:bg-amber-900/10 dark:hover:bg-amber-100/10"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user && profile ? (
            <div className="relative">
              {menuOpen && (
                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
              )}
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-full transition hover:ring-2 hover:ring-amber-400"
                title={profile.username}
              >
                <AvatarWithFrame
                  src={profile.avatar_url}
                  frame={frame}
                  treasure={treasure}
                  size={38}
                  username={profile.username}
                />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-amber-900/20 bg-white shadow-xl dark:border-amber-100/15 dark:bg-stone-900">
                  <div className="border-b border-amber-900/10 px-4 py-3 dark:border-amber-100/10">
                    <p className="truncate font-semibold text-amber-950 dark:text-amber-100">
                      {profile.username}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {profile.role === 'admin' ? '👑 Quản trị viên' : '📖 Đạo hữu'} · 💎{' '}
                      {profile.spirit_stones} linh thạch
                    </p>
                  </div>
                  {menuItems
                    .filter((m) => !m.adminOnly || isAdmin)
                    .map((m) => (
                      <button
                        key={m.to}
                        onClick={() => go(m.to)}
                        className="block w-full px-4 py-2.5 text-left text-sm text-stone-700 hover:bg-amber-100/70 dark:text-stone-200 dark:hover:bg-stone-800"
                      >
                        {m.label}
                      </button>
                    ))}
                  <button
                    onClick={doSignOut}
                    className="block w-full border-t border-amber-900/10 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:border-amber-100/10 dark:hover:bg-red-950/40"
                  >
                    🚪 Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth"
                className="rounded-full px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-900/10 dark:text-amber-200 dark:hover:bg-amber-100/10"
              >
                Đăng nhập
              </Link>
              <Link
                to="/auth?mode=register"
                className="rounded-full bg-amber-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ô tìm kiếm cho mobile */}
      <form onSubmit={submitSearch} className="px-3 pb-2 sm:hidden">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm truyện, tác giả..."
          className="w-full rounded-full border border-amber-900/20 bg-white px-4 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-amber-100/15 dark:bg-stone-900 dark:text-stone-100"
        />
      </form>
    </header>
  );
}

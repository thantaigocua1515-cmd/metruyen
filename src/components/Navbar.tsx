import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTemplate } from '../context/TemplateContext';
import AvatarWithFrame from './AvatarWithFrame';
import { fetchEquippedItems } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';

export default function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { template } = useTemplate();
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

  const submitSearch = (e: FormEvent) => {
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

  const dropdown = (
    <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border bg-[var(--card-bg)] shadow-xl"
      style={{ borderColor: 'color-mix(in srgb, var(--ink) 15%, transparent)' }}>
      <div className="border-b px-4 py-3" style={{ borderColor: 'color-mix(in srgb, var(--ink) 10%, transparent)' }}>
        <p className="truncate font-semibold" style={{ color: 'var(--ink)' }}>
          {profile?.username}
        </p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {profile?.role === 'admin' ? '👑 Quản trị viên' : '📖 Đạo hữu'} · 💎{' '}
          {profile?.spirit_stones} linh thạch
        </p>
      </div>
      {menuItems
        .filter((m) => !m.adminOnly || isAdmin)
        .map((m) => (
          <button
            key={m.to + m.label}
            onClick={() => go(m.to)}
            className="block w-full px-4 py-2.5 text-left text-sm hover:opacity-80"
            style={{ color: 'var(--ink)', background: 'transparent' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-soft)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {m.label}
          </button>
        ))}
      <button
        onClick={doSignOut}
        className="block w-full border-t px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
        style={{ borderColor: 'color-mix(in srgb, var(--ink) 10%, transparent)' }}
      >
        🚪 Đăng xuất
      </button>
    </div>
  );

  const themeBtn = (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
      className="rounded-full p-2 text-lg transition hover:opacity-70"
      style={{ color: 'var(--ink)' }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );

  /* ---------- Variant TruyenC: header kiểu app hiện đại ---------- */
  if (template === 'truyenc') {
    return (
      <header
        className="sticky top-0 z-40 border-b bg-[var(--card-bg)]/95 backdrop-blur"
        style={{ borderColor: 'color-mix(in srgb, var(--ink) 10%, transparent)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-3 py-2.5 sm:gap-2 sm:px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-2xl"
              style={{ background: 'var(--brand-soft)' }}
            >
              📖
            </span>
            <span className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>
              Mê <span style={{ color: 'var(--brand)' }}>Truyện</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => navigate('/search')}
              title="Tìm kiếm"
              className="rounded-full p-2 text-xl transition hover:opacity-70"
              style={{ color: 'var(--ink)' }}
            >
              🔍
            </button>
            {themeBtn}
            {user && profile ? (
              <div className="relative">
                {menuOpen && (
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                )}
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="rounded-full p-2 text-xl transition hover:opacity-70"
                  style={{ color: 'var(--ink)' }}
                  title="Menu"
                >
                  ☰
                </button>
                {menuOpen && dropdown}
              </div>
            ) : (
              <Link
                to="/auth"
                className="ml-1 rounded-full px-5 py-2 text-sm font-bold text-white shadow transition hover:opacity-90"
                style={{ background: 'var(--brand)' }}
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  /* ---------- Variant tinh-ha: navbar blur, wordmark serif ---------- */
  if (template === 'tinh-ha') {
    return (
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          borderColor: 'var(--border, color-mix(in srgb, var(--ink) 12%, transparent))',
          background: 'color-mix(in srgb, var(--page-bg) 82%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:gap-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span
              className="text-2xl font-semibold tracking-wide"
              style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
            >
              Mê <span style={{ color: 'var(--brand)' }}>Truyện</span>
            </span>
          </Link>

          <form onSubmit={submitSearch} className="hidden flex-1 sm:block">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm truyện, tác giả..."
              aria-label="Tìm truyện"
              className="min-h-[44px] w-full rounded-full bg-[var(--card-bg)] px-5 text-sm outline-none transition"
              style={{ border: '1px solid var(--border, color-mix(in srgb, var(--ink) 18%, transparent))', color: 'var(--ink)' }}
            />
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {themeBtn}

            {user && profile ? (
              <div className="relative">
                {menuOpen && (
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                )}
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="min-h-[44px] min-w-[44px] rounded-full transition hover:ring-2"
                  style={{ ['--tw-ring-color' as string]: 'var(--brand)' } as CSSProperties}
                  title={profile.username}
                  aria-label="Menu tài khoản"
                >
                  <AvatarWithFrame
                    src={profile.avatar_url}
                    frame={frame}
                    treasure={treasure}
                    size={38}
                    username={profile.username}
                  />
                </button>
                {menuOpen && dropdown}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/auth"
                  className="inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold transition hover:opacity-70"
                  style={{ color: 'var(--brand)' }}
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold text-white transition hover:opacity-90 dark:text-stone-950"
                  style={{ background: 'var(--brand)' }}
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ô tìm kiếm cho mobile */}
        <form onSubmit={submitSearch} className="px-4 pb-2.5 sm:hidden">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm truyện, tác giả..."
            aria-label="Tìm truyện"
            className="min-h-[44px] w-full rounded-full bg-[var(--card-bg)] px-5 text-sm outline-none transition"
            style={{ border: '1px solid var(--border, color-mix(in srgb, var(--ink) 18%, transparent))', color: 'var(--ink)' }}
          />
        </form>
      </header>
    );
  }

  /* ---------- Các template còn lại: navbar hiện tại, ăn theo brand var ---------- */
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        borderColor: 'color-mix(in srgb, var(--ink) 15%, transparent)',
        background: 'color-mix(in srgb, var(--card-bg) 90%, transparent)',
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="text-2xl">📚</span>
          <span
            className="text-xl font-bold"
            style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
          >
            Mê Truyện
          </span>
        </Link>

        <form onSubmit={submitSearch} className="hidden flex-1 sm:block">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm truyện, tác giả..."
            className="w-full rounded-full border bg-[var(--card-bg)] px-4 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
            style={{ borderColor: 'color-mix(in srgb, var(--ink) 18%, transparent)', color: 'var(--ink)' }}
          />
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {themeBtn}

          {user && profile ? (
            <div className="relative">
              {menuOpen && (
                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
              )}
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-full transition hover:ring-2"
                style={{ ['--tw-ring-color' as string]: 'var(--brand)' } as CSSProperties}
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
              {menuOpen && dropdown}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth"
                className="rounded-full px-3 py-1.5 text-sm transition hover:opacity-70"
                style={{ color: 'var(--brand)' }}
              >
                Đăng nhập
              </Link>
              <Link
                to="/auth?mode=register"
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: 'var(--brand)' }}
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
          className="w-full rounded-full border bg-[var(--card-bg)] px-4 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
          style={{ borderColor: 'color-mix(in srgb, var(--ink) 18%, transparent)', color: 'var(--ink)' }}
        />
      </form>
    </header>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTemplate } from '../context/TemplateContext';
import AvatarWithFrame from './AvatarWithFrame';
import { fetchEquippedItems } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';
import { SearchIcon } from './icons';

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
    { label: '⚙️ Quản trị SaaS', to: '/admin', adminOnly: true },
  ];

  const dropdown = (
    <div
      className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border bg-[var(--card-bg)] shadow-2xl backdrop-blur-xl animate-fade-up"
      style={{ borderColor: 'color-mix(in srgb, var(--ink) 14%, transparent)' }}
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: 'color-mix(in srgb, var(--ink) 10%, transparent)' }}
      >
        <p className="truncate font-bold" style={{ color: 'var(--ink)' }}>
          {profile?.username}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
          {profile?.role === 'admin' ? '👑 Quản trị viên' : '📖 Đạo hữu'} · 💎{' '}
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {profile?.spirit_stones ?? 0}
          </span>{' '}
          linh thạch
        </p>
      </div>
      <div className="py-1">
        {menuItems
          .filter((m) => !m.adminOnly || isAdmin)
          .map((m) => (
            <button
              key={m.to + m.label}
              onClick={() => go(m.to)}
              className="flex w-full items-center px-4 py-2 text-left text-sm transition"
              style={{ color: 'var(--ink)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {m.label}
            </button>
          ))}
      </div>
      <div
        className="border-t py-1"
        style={{ borderColor: 'color-mix(in srgb, var(--ink) 10%, transparent)' }}
      >
        <button
          onClick={doSignOut}
          className="flex w-full items-center px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          🚪 Đăng xuất
        </button>
      </div>
    </div>
  );

  const themeBtn = (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
      className="flex h-10 w-10 items-center justify-center rounded-full text-base transition hover:bg-black/5 dark:hover:bg-white/10"
      style={{ color: 'var(--ink)' }}
      aria-label="Đổi giao diện sáng tối"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );

  /* =========================================================
     1. THƯ CÁC TU TIÊN (thu-cac) — Cổng Tàng Kinh Các
     ========================================================= */
  if (template === 'thu-cac') {
    return (
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          borderColor: 'color-mix(in srgb, var(--brand) 25%, transparent)',
          background: 'color-mix(in srgb, var(--card-bg) 92%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 group">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-xl shadow-inner group-hover:scale-105 transition-transform">
              📜
            </span>
            <div className="flex flex-col">
              <span
                className="text-xl font-extrabold tracking-wider text-amber-900 dark:text-amber-100"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                MÊ TRUYỆN
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-amber-700 dark:text-amber-400">
                Tàng Thư Các
              </span>
            </div>
          </Link>

          <form onSubmit={submitSearch} className="hidden flex-1 sm:block max-w-md mx-auto">
            <div className="relative">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tra cứu tiên thư, tác giả, thần thông..."
                className="w-full rounded-xl border bg-[var(--card-bg)] pl-10 pr-4 py-2 text-sm outline-none transition focus:border-amber-600 focus:ring-1 focus:ring-amber-500"
                style={{
                  borderColor: 'color-mix(in srgb, var(--brand) 25%, transparent)',
                  color: 'var(--ink)',
                }}
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                <SearchIcon className="h-4 w-4" />
              </span>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            {themeBtn}
            {user && profile ? (
              <div className="relative">
                {menuOpen && (
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                )}
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="rounded-full transition hover:ring-2 ring-amber-500"
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
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-amber-900 dark:text-amber-200 transition hover:bg-amber-100/50"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="rounded-xl px-4 py-2 text-sm font-bold text-white shadow transition hover:opacity-90"
                  style={{ background: 'var(--brand)' }}
                >
                  Gia nhập
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  }

  /* =========================================================
     2. TRUYENC HIỆN ĐẠI (truyenc) — App Webtoon Bar Tím Hồng
     ========================================================= */
  if (template === 'truyenc') {
    return (
      <header
        className="sticky top-0 z-40 border-b bg-white/90 dark:bg-[#110d22]/90 backdrop-blur-xl"
        style={{ borderColor: 'color-mix(in srgb, var(--brand) 15%, transparent)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white font-extrabold text-xl shadow-md shadow-purple-500/25">
              M
            </span>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Mê<span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">Truyện</span>
            </span>
          </Link>

          <form onSubmit={submitSearch} className="hidden flex-1 sm:block max-w-md mx-6">
            <div className="relative">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm kiếm truyện tranh, tiểu thuyết..."
                className="w-full rounded-full border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 pl-10 pr-4 py-2 text-sm outline-none transition focus:border-purple-500 focus:bg-white dark:focus:bg-purple-950/40"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400">
                <SearchIcon className="h-4 w-4" />
              </span>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => navigate('/search')}
              title="Tìm kiếm"
              className="sm:hidden flex h-10 w-10 items-center justify-center rounded-full text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
            {themeBtn}
            {user && profile ? (
              <div className="relative">
                {menuOpen && (
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                )}
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="rounded-full transition hover:ring-2 ring-purple-500"
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
              <Link
                to="/auth"
                className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-purple-500/20 transition hover:opacity-95"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  /* =========================================================
     3. DẠ HUYỀN ẢO (da-huyen-ao) — Kính Mờ Ma Quái Neon
     ========================================================= */
  if (template === 'da-huyen-ao') {
    return (
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-2xl bg-[#090714]/85"
        style={{ borderColor: 'rgba(139, 92, 246, 0.25)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-950/70 border border-purple-500/40 text-xl shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              🔮
            </span>
            <span
              className="text-xl font-bold tracking-widest text-purple-200"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              DẠ <span className="text-purple-400">HUYỀN ẢO</span>
            </span>
          </Link>

          <form onSubmit={submitSearch} className="hidden flex-1 sm:block max-w-md mx-auto">
            <div className="relative">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Truy tầm bí thuật, ma điển, cấm thư..."
                className="w-full rounded-xl border border-purple-500/30 bg-[#120c24] pl-10 pr-4 py-2 text-sm text-purple-100 outline-none transition focus:border-purple-400 focus:shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400">
                <SearchIcon className="h-4 w-4" />
              </span>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            {themeBtn}
            {user && profile ? (
              <div className="relative">
                {menuOpen && (
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                )}
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="rounded-full transition hover:ring-2 ring-purple-400"
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
              <Link
                to="/auth"
                className="rounded-xl border border-purple-500/50 bg-purple-950/50 px-5 py-2 text-sm font-semibold text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)] transition hover:bg-purple-900/60"
              >
                Nhập Đạo
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  /* =========================================================
     4. CỔ PHONG (co-phong) — Hoành Phi Thư Pháp & Triện Đỏ
     ========================================================= */
  if (template === 'co-phong') {
    return (
      <header
        className="sticky top-0 z-40 border-b bg-[#f5efe1]/95 dark:bg-[#1a140d]/95 backdrop-blur-md"
        style={{ borderColor: 'color-mix(in srgb, var(--brand) 30%, transparent)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <span className="seal-stamp text-sm">
              [ 迷 書 ]
            </span>
            <div className="flex flex-col">
              <span
                className="text-2xl font-bold tracking-widest text-red-900 dark:text-red-400"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                MÊ TRUYỆN THƯ XÁ
              </span>
              <span className="text-[10px] font-serif tracking-widest text-stone-600 dark:text-stone-400">
                Giang Hồ Thủy Mặc · Nhàn Vân Dã Hạc
              </span>
            </div>
          </Link>

          <form onSubmit={submitSearch} className="hidden flex-1 sm:block max-w-md mx-auto">
            <div className="relative">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm kiếm kỳ thư kiếm hiệp..."
                className="w-full rounded border border-stone-300 dark:border-stone-700 bg-[#fffefc] dark:bg-[#251e15] pl-10 pr-4 py-1.5 text-sm font-serif outline-none focus:border-red-700"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                <SearchIcon className="h-4 w-4" />
              </span>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            {themeBtn}
            {user && profile ? (
              <div className="relative">
                {menuOpen && (
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                )}
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="rounded-full transition hover:ring-2 ring-red-700"
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
              <Link
                to="/auth"
                className="rounded border border-red-800 bg-red-800 px-4 py-1.5 text-sm font-serif font-bold text-white transition hover:bg-red-900"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  /* =========================================================
     5. TỐI GIẢN (toi-gian) — Swiss Modernist Minimal Bar
     ========================================================= */
  if (template === 'toi-gian') {
    return (
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-black/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-sm tracking-[0.25em] font-bold text-zinc-900 dark:text-zinc-100 uppercase">
              MÊ TRUYỆN
            </span>
          </Link>

          <form onSubmit={submitSearch} className="hidden flex-1 sm:block max-w-sm mx-auto">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search directory..."
              className="w-full border-b border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            {themeBtn}
            {user && profile ? (
              <div className="relative">
                {menuOpen && (
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                )}
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="rounded-full transition hover:opacity-80"
                  title={profile.username}
                >
                  <AvatarWithFrame
                    src={profile.avatar_url}
                    frame={frame}
                    treasure={treasure}
                    size={34}
                    username={profile.username}
                  />
                </button>
                {menuOpen && dropdown}
              </div>
            ) : (
              <Link
                to="/auth"
                className="font-mono text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 hover:underline"
              >
                Sign In →
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  /* =========================================================
     6. TINH HÀ (tinh-ha) — Thư Các Điện Ảnh Cao Cấp
     ========================================================= */
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-2xl"
      style={{
        borderColor: 'var(--border, color-mix(in srgb, var(--ink) 12%, transparent))',
        background: 'color-mix(in srgb, var(--page-bg) 85%, transparent)',
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-3">
          <span
            className="text-2xl font-bold tracking-wide"
            style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}
          >
            Mê <span style={{ color: 'var(--brand)' }}>Truyện</span>
          </span>
        </Link>

        <form onSubmit={submitSearch} className="hidden flex-1 sm:block max-w-md">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm truyện, tác giả..."
            aria-label="Tìm truyện"
            className="w-full rounded-full bg-[var(--card-bg)] px-5 py-2 text-sm outline-none transition"
            style={{
              border: '1px solid var(--border, color-mix(in srgb, var(--ink) 18%, transparent))',
              color: 'var(--ink)',
            }}
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
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
                className="rounded-full px-4 py-1.5 text-sm font-semibold transition hover:opacity-75"
                style={{ color: 'var(--brand)' }}
              >
                Đăng nhập
              </Link>
              <Link
                to="/auth?mode=register"
                className="rounded-full px-5 py-1.5 text-sm font-bold text-white shadow transition hover:opacity-90 dark:text-stone-950"
                style={{ background: 'var(--brand)' }}
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

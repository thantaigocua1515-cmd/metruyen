import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChrome } from '../context/ChromeContext';
import { useTheme } from '../context/ThemeContext';
import { useTemplate } from '../context/TemplateContext';
import AvatarWithFrame from './AvatarWithFrame';
import { fetchEquippedItems } from '../lib/equipped';
import type { EquippedItem } from '../lib/equipped';
import { getRank } from '../lib/tuvi';
import {
  BagIcon,
  BookmarkIcon,
  BookOpenIcon,
  CompassIcon,
  GemIcon,
  GridIcon,
  HomeIcon,
  LogOutIcon,
  MoonIcon,
  ScrollIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  StoreIcon,
  SunIcon,
  TrophyIcon,
  UserIcon,
} from './icons';

export default function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { hidden: chromeHidden } = useChrome();
  const { theme, toggle } = useTheme();
  const { template } = useTemplate();
  const navigate = useNavigate();
  const { pathname } = useLocation();
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

  const menuItems: { label: string; to: string; icon: ReactNode; adminOnly?: boolean }[] = [
    { label: 'Trang cá nhân', to: '/profile', icon: <UserIcon className="h-4 w-4" /> },
    { label: 'Tủ truyện', to: '/bookshelf', icon: <BookmarkIcon className="h-4 w-4" /> },
    { label: 'Túi trữ vật', to: '/inventory', icon: <BagIcon className="h-4 w-4" /> },
    { label: 'Tàng Bảo Các', to: '/treasury', icon: <StoreIcon className="h-4 w-4" /> },
    { label: 'Bảng xếp hạng', to: '/leaderboard', icon: <TrophyIcon className="h-4 w-4" /> },
    { label: 'Quản trị hệ thống', to: '/admin', icon: <SettingsIcon className="h-4 w-4" />, adminOnly: true },
  ];

  const rank = profile ? getRank(profile.reading_seconds / 3600) : null;

  const dropdown = (
    <div
      className="absolute right-0 z-50 mt-2.5 w-64 overflow-hidden rounded-2xl border bg-[var(--card-bg)] shadow-2xl"
      style={{ borderColor: 'var(--border, color-mix(in srgb, var(--ink) 15%, transparent))' }}
    >
      <div
        className="border-b px-4 py-3.5"
        style={{
          borderColor: 'var(--border, color-mix(in srgb, var(--ink) 10%, transparent))',
          background: 'var(--surface-alt)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold" style={{ color: 'var(--ink)' }}>
            {profile?.username}
          </p>
          {rank && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
            >
              {rank.name}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
          <span>{profile?.role === 'admin' ? 'Quản trị viên' : 'Đạo hữu'}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand)' }}>
            <GemIcon className="h-3.5 w-3.5" />
            {profile?.spirit_stones ?? 0} linh thạch
          </span>
        </div>
      </div>
      <div className="p-1.5">
        {menuItems
          .filter((m) => !m.adminOnly || isAdmin)
          .map((m) => (
            <button
              key={m.to}
              onClick={() => go(m.to)}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition"
              style={{ color: 'var(--ink)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: 'var(--brand)' }}>{m.icon}</span>
              {m.label}
            </button>
          ))}
      </div>
      <div
        className="border-t p-1.5"
        style={{ borderColor: 'var(--border, color-mix(in srgb, var(--ink) 10%, transparent))' }}
      >
        <button
          onClick={() => void doSignOut()}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <LogOutIcon className="h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  );

  const themeBtn = (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
      aria-label={theme === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition hover:opacity-75"
      style={{
        color: 'var(--ink)',
        background: 'var(--surface-alt)',
        border: '1px solid var(--border)',
      }}
    >
      {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );

  const userControl =
    user && profile ? (
      <div className="relative">
        {menuOpen && (
          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
        )}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex min-h-[42px] min-w-[42px] cursor-pointer items-center justify-center rounded-full transition hover:ring-2"
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
          className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition hover:opacity-80"
          style={{ color: 'var(--ink)' }}
        >
          Đăng nhập
        </Link>
        <Link
          to="/auth?mode=register"
          className="inline-flex h-10 items-center rounded-full px-5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: 'var(--brand)' }}
        >
          Đăng ký
        </Link>
      </div>
    );

  /* ---------- Chế độ toàn màn hình khi đọc truyện ---------- */
  if (chromeHidden) return null;

  /* ========================================================================
     1. VARIANT: TRUYENC (Super-App Floating Pill Header)
     ======================================================================== */
  if (template === 'truyenc') {
    const navPills = [
      { to: '/', label: 'Khám phá', icon: <HomeIcon className="h-4 w-4" /> },
      { to: '/genres', label: 'Thể loại', icon: <GridIcon className="h-4 w-4" /> },
      { to: '/leaderboard', label: 'Xếp hạng', icon: <TrophyIcon className="h-4 w-4" /> },
      { to: '/bookshelf', label: 'Tủ sách', icon: <BookmarkIcon className="h-4 w-4" /> },
    ];
    return (
      <header className="sticky top-0 z-40 px-3 pt-2.5 pb-1.5 sm:px-6">
        <div
          className="mx-auto flex max-w-7xl items-center gap-3 rounded-2xl border bg-[var(--card-bg)]/90 px-4 py-2.5 shadow-[0_8px_30px_rgba(124,58,237,0.08)] backdrop-blur-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md"
              style={{
                background: 'linear-gradient(135deg, var(--brand), var(--accent))',
              }}
            >
              <BookOpenIcon className="h-5 w-5" />
            </span>
            <div className="leading-none">
              <span className="font-display text-lg font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>
                Mê<span style={{ color: 'var(--brand)' }}>Truyện</span>
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Novel Portal
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navPills.map((item) => {
              const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition"
                  style={
                    active
                      ? { background: 'var(--brand-soft)', color: 'var(--brand)' }
                      : { color: 'var(--muted)' }
                  }
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form onSubmit={submitSearch} className="relative ml-auto hidden max-w-xs flex-1 md:block">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm truyện, tác giả..."
              aria-label="Tìm truyện"
              className="h-10 w-full rounded-xl pl-10 pr-4 text-sm outline-none transition"
              style={{
                background: 'var(--surface-alt)',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
              }}
            />
          </form>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button
              onClick={() => navigate('/search')}
              title="Tìm kiếm"
              aria-label="Tìm kiếm"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full md:hidden"
              style={{ background: 'var(--surface-alt)', color: 'var(--ink)' }}
            >
              <SearchIcon className="h-4 w-4" />
            </button>
            {themeBtn}
            {userControl}
          </div>
        </div>
      </header>
    );
  }

  /* ========================================================================
     2. VARIANT: DA-HUYEN-AO (Arcane RPG Codex HUD Bar)
     ======================================================================== */
  if (template === 'da-huyen-ao') {
    return (
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          borderColor: 'var(--border)',
          background: 'linear-gradient(180deg, rgba(14,9,28,0.94), rgba(8,6,18,0.88))',
          boxShadow: '0 4px 30px rgba(139, 92, 246, 0.14)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg border transition group-hover:scale-105"
              style={{
                borderColor: 'rgba(34, 211, 238, 0.5)',
                background: 'radial-gradient(circle at 30% 30%, rgba(168,85,247,0.4), rgba(14,9,28,0.9))',
                color: 'var(--accent)',
              }}
            >
              <SparklesIcon className="h-5 w-5" />
            </span>
            <div>
              <span
                className="font-display block text-lg font-bold tracking-[0.14em] uppercase"
                style={{ color: 'var(--ink)' }}
              >
                Huyền Thiên Các
              </span>
              <span className="font-mono-tech block text-[10px] tracking-widest" style={{ color: 'var(--accent)' }}>
                ARCANE CODEX // MÊ TRUYỆN
              </span>
            </div>
          </Link>

          {/* HUD Realm Status Pill */}
          {user && profile && rank && (
            <div
              className="hidden items-center gap-3 rounded-xl border px-3.5 py-1.5 xl:flex"
              style={{
                borderColor: 'var(--border)',
                background: 'rgba(27, 19, 54, 0.65)',
              }}
            >
              <div className="text-xs">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Cảnh giới:
                </span>{' '}
                <strong style={{ color: 'var(--accent)' }}>{rank.name}</strong>
              </div>
              <div className="h-2 w-20 overflow-hidden rounded-full bg-black/50">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${rank.progress}%`,
                    background: 'linear-gradient(90deg, var(--brand), var(--accent))',
                  }}
                />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--brand-strong)' }}>
                <GemIcon className="h-3.5 w-3.5" />
                {profile.spirit_stones}
              </span>
            </div>
          )}

          <form onSubmit={submitSearch} className="relative mx-auto hidden max-w-md flex-1 md:block">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Truy tìm cổ tịch, chân kinh..."
              aria-label="Tìm truyện"
              className="h-10 w-full rounded-xl pl-10 pr-4 text-sm outline-none transition"
              style={{
                background: 'rgba(27, 19, 54, 0.7)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
              }}
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/treasury"
              className="hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold tracking-wider uppercase transition hover:opacity-90 sm:inline-flex"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--brand-soft)',
                color: 'var(--ink)',
              }}
            >
              <StoreIcon className="h-3.5 w-3.5" />
              Bảo Các
            </Link>
            {themeBtn}
            {userControl}
          </div>
        </div>
      </header>
    );
  }

  /* ========================================================================
     3. VARIANT: CO-PHONG (Oriental Scroll Masthead & Seal)
     ======================================================================== */
  if (template === 'co-phong') {
    const links = [
      { to: '/', label: 'Tàng Thư' },
      { to: '/genres', label: 'Phân Loại' },
      { to: '/leaderboard', label: 'Phong Thần Bảng' },
      { to: '/bookshelf', label: 'Thư Phòng' },
      { to: '/treasury', label: 'Tàng Bảo Các' },
    ];
    return (
      <header
        className="sticky top-0 z-40 border-b-2 backdrop-blur-md"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--page-bg) 94%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <span className="cophong-seal h-10 w-10 rounded text-xs leading-tight">
              MÊ
              <br />
              THƯ
            </span>
            <div>
              <span
                className="font-display block text-2xl font-bold tracking-wider"
                style={{ color: 'var(--ink)' }}
              >
                Mê Truyện Các
              </span>
              <span className="block text-[11px] tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
                CỔ PHONG THƯ VIỆN
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {links.map((l) => {
              const active = l.to === '/' ? pathname === '/' : pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className="font-display relative py-1 text-base font-semibold transition"
                  style={{ color: active ? 'var(--brand)' : 'var(--ink)' }}
                >
                  {l.label}
                  {active && (
                    <span
                      className="absolute inset-x-0 -bottom-1 h-0.5"
                      style={{ background: 'var(--brand)' }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <form onSubmit={submitSearch} className="relative hidden sm:block">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tầm thư..."
                aria-label="Tìm truyện"
                className="h-9 w-44 rounded border pl-9 pr-3 text-sm outline-none transition focus:w-56"
                style={{
                  background: 'var(--card-bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--ink)',
                }}
              />
            </form>
            {themeBtn}
            {userControl}
          </div>
        </div>
      </header>
    );
  }

  /* ========================================================================
     4. VARIANT: TOI-GIAN (Swiss Modernism 2.0 Architectural Bar)
     ======================================================================== */
  if (template === 'toi-gian') {
    return (
      <header
        className="sticky top-0 z-40 border-b bg-[var(--page-bg)]"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-12 items-center px-4 sm:px-6">
          <div
            className="col-span-6 flex items-center gap-3 border-r py-3 pr-4 sm:col-span-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <Link to="/" className="flex items-baseline gap-2">
              <span className="font-mono-tech text-xs font-bold" style={{ color: 'var(--brand)' }}>
                [MT—01]
              </span>
              <span className="font-display text-lg font-extrabold tracking-tighter uppercase" style={{ color: 'var(--ink)' }}>
                MÊ TRUYỆN
              </span>
            </Link>
          </div>

          <div
            className="col-span-5 hidden border-r px-4 py-3 md:block"
            style={{ borderColor: 'var(--border)' }}
          >
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <SearchIcon className="h-4 w-4 shrink-0 opacity-60" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="SEARCH ARCHIVE / AUTHOR..."
                aria-label="Tìm truyện"
                className="font-mono-tech w-full bg-transparent text-xs tracking-wider uppercase outline-none"
                style={{ color: 'var(--ink)' }}
              />
            </form>
          </div>

          <div className="col-span-6 flex items-center justify-end gap-3 py-2 pl-4 sm:col-span-9 md:col-span-4">
            <Link
              to="/genres"
              className="font-mono-tech hidden text-xs font-semibold tracking-wider uppercase hover:underline lg:inline"
              style={{ color: 'var(--muted)' }}
            >
              INDEX
            </Link>
            <Link
              to="/leaderboard"
              className="font-mono-tech hidden text-xs font-semibold tracking-wider uppercase hover:underline lg:inline"
              style={{ color: 'var(--muted)' }}
            >
              RANKING
            </Link>
            {themeBtn}
            {userControl}
          </div>
        </div>
      </header>
    );
  }

  /* ========================================================================
     5. VARIANT: TINH-HA (Cinematic Widescreen Glass Header)
     ======================================================================== */
  if (template === 'tinh-ha') {
    return (
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--page-bg) 82%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span
              className="font-display text-2xl font-bold tracking-wide"
              style={{ color: 'var(--ink)' }}
            >
              Mê <span style={{ color: 'var(--brand)' }}>Truyện</span>
            </span>
            <span
              className="hidden rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.2em] uppercase sm:inline-block"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              Cinema Edition
            </span>
          </Link>

          <form onSubmit={submitSearch} className="relative hidden flex-1 sm:block max-w-md mx-auto">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tác phẩm, tác giả..."
              aria-label="Tìm truyện"
              className="h-10 w-full rounded-full bg-[var(--card-bg)] pl-11 pr-5 text-sm outline-none transition"
              style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/genres"
              className="hidden items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition hover:opacity-80 md:inline-flex"
              style={{ color: 'var(--ink)' }}
            >
              <CompassIcon className="h-4 w-4" />
              Danh mục
            </Link>
            {themeBtn}
            {userControl}
          </div>
        </div>
      </header>
    );
  }

  /* ========================================================================
     6. DEFAULT: THU-CAC (Scholarly Library Masthead)
     ======================================================================== */
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in srgb, var(--page-bg) 90%, transparent)',
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-5 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm"
            style={{
              background: 'var(--brand-soft)',
              borderColor: 'var(--border)',
              color: 'var(--brand-strong)',
            }}
          >
            <ScrollIcon className="h-5 w-5" />
          </span>
          <div>
            <span
              className="font-display block text-xl font-bold leading-none sm:text-2xl"
              style={{ color: 'var(--ink)' }}
            >
              Thư Các <span style={{ color: 'var(--brand)' }}>Mê Truyện</span>
            </span>
            <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
              Tàng Kinh Các • Đọc truyện tu tiên
            </span>
          </div>
        </Link>

        <form onSubmit={submitSearch} className="relative hidden max-w-md flex-1 sm:block">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm danh tác, đạo hiệu tác giả..."
            aria-label="Tìm truyện"
            className="h-10 w-full rounded-full bg-[var(--card-bg)] pl-10 pr-4 text-sm outline-none transition"
            style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/leaderboard"
            className="hidden items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition hover:opacity-80 lg:inline-flex"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--ink)',
            }}
          >
            <TrophyIcon className="h-3.5 w-3.5" />
            Bảng Tu Vi
          </Link>
          {themeBtn}
          {userControl}
        </div>
      </div>

      {/* ô tìm kiếm cho mobile */}
      <form onSubmit={submitSearch} className="px-4 pb-2.5 sm:hidden">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm truyện, tác giả..."
            aria-label="Tìm truyện"
            className="h-10 w-full rounded-full bg-[var(--card-bg)] pl-10 pr-4 text-sm outline-none"
            style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
          />
        </div>
      </form>
    </header>
  );
}

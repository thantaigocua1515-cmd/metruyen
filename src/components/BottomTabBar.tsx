import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChrome } from '../context/ChromeContext';
import { useTemplate } from '../context/TemplateContext';
import { BookmarkIcon, GridIcon, HomeIcon, SearchIcon, TrophyIcon, UserIcon } from './icons';

interface TabItem {
  to: string;
  label: string;
  code: string;
  icon: ReactNode;
  match: (p: string) => boolean;
}

const TABS: TabItem[] = [
  {
    to: '/',
    label: 'Trang chủ',
    code: '01',
    icon: <HomeIcon className="h-5 w-5" />,
    match: (p) => p === '/',
  },
  {
    to: '/genres',
    label: 'Thể loại',
    code: '02',
    icon: <GridIcon className="h-5 w-5" />,
    match: (p) => p.startsWith('/genres') || p.startsWith('/novel'),
  },
  {
    to: '/search',
    label: 'Tìm kiếm',
    code: '03',
    icon: <SearchIcon className="h-5 w-5" />,
    match: (p) => p.startsWith('/search'),
  },
  {
    to: '/leaderboard',
    label: 'Xếp hạng',
    code: '04',
    icon: <TrophyIcon className="h-5 w-5" />,
    match: (p) => p.startsWith('/leaderboard'),
  },
  {
    to: '/bookshelf',
    label: 'Tủ sách',
    code: '05',
    icon: <BookmarkIcon className="h-5 w-5" />,
    match: (p) => p.startsWith('/bookshelf'),
  },
  {
    to: '__account',
    label: 'Tài khoản',
    code: '06',
    icon: <UserIcon className="h-5 w-5" />,
    match: (p) =>
      p.startsWith('/profile') ||
      p.startsWith('/auth') ||
      p.startsWith('/user') ||
      p.startsWith('/inventory') ||
      p.startsWith('/treasury'),
  },
];

const RANGE = 110;
const MAX_SCALE = 1.38;

/**
 * Thanh điều hướng dưới cùng thích ứng theo từng Template.
 */
export default function BottomTabBar() {
  const { user } = useAuth();
  const { hidden: chromeHidden } = useChrome();
  const { template } = useTemplate();
  const { pathname } = useLocation();
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const centersRef = useRef<number[]>([]);
  const [scales, setScales] = useState<number[]>(() => TABS.map(() => 1));

  const measure = useCallback(() => {
    centersRef.current = itemRefs.current.map((el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2;
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, pathname, template]);

  const onMove = (e: React.MouseEvent) => {
    const x = e.clientX;
    setScales(
      TABS.map((_, i) => {
        const c = centersRef.current[i] ?? 0;
        const d = Math.abs(x - c);
        if (d >= RANGE) return 1;
        const t = Math.cos((d / RANGE) * (Math.PI / 2));
        return 1 + (MAX_SCALE - 1) * t * t;
      }),
    );
  };

  const onLeave = () => setScales(TABS.map(() => 1));

  if (chromeHidden) return null;

  /* ---------- Variant 1: TOI-GIAN (Swiss Brutalist Rectangular Strip) ---------- */
  if (template === 'toi-gian') {
    return (
      <>
        <div className="h-24" aria-hidden />
        <nav
          className="fixed left-1/2 z-40 -translate-x-1/2"
          style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          aria-label="Điều hướng chính"
        >
          <div
            className="flex border bg-[var(--card-bg)] shadow-[4px_4px_0_var(--border)]"
            style={{ borderColor: 'var(--border)' }}
          >
            {TABS.map((t, i) => {
              const to = t.to === '__account' ? (user ? '/profile' : '/auth') : t.to;
              const active = t.match(pathname);
              return (
                <Link
                  key={t.to}
                  to={to}
                  className="flex min-w-[58px] flex-col items-center justify-center px-3 py-2 text-center transition sm:min-w-[84px] sm:flex-row sm:gap-1.5"
                  style={{
                    borderRight: i < TABS.length - 1 ? '1px solid var(--border)' : 'none',
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--page-bg)' : 'var(--ink)',
                  }}
                >
                  <span className="font-mono-tech text-[10px] opacity-60">{t.code}</span>
                  <span className="text-[11px] font-bold tracking-tight uppercase">{t.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </>
    );
  }

  /* ---------- Variant 2: CO-PHONG (Wooden/Scroll Tablet Bar) ---------- */
  if (template === 'co-phong') {
    return (
      <>
        <div className="h-24" aria-hidden />
        <nav
          className="fixed left-1/2 z-40 -translate-x-1/2"
          style={{ bottom: 'max(0.85rem, env(safe-area-inset-bottom))' }}
          aria-label="Điều hướng chính"
        >
          <div
            className="cophong-frame flex items-center gap-1 rounded-lg px-2.5 py-1.5 shadow-xl sm:gap-2 sm:px-4"
          >
            {TABS.map((t) => {
              const to = t.to === '__account' ? (user ? '/profile' : '/auth') : t.to;
              const active = t.match(pathname);
              return (
                <Link
                  key={t.to}
                  to={to}
                  className="flex flex-col items-center rounded px-2.5 py-1.5 transition sm:px-3"
                  style={
                    active
                      ? { background: 'var(--brand)', color: '#fff' }
                      : { color: 'var(--ink)' }
                  }
                >
                  {t.icon}
                  <span className="font-display mt-0.5 text-[11px] font-semibold whitespace-nowrap">
                    {t.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </>
    );
  }

  /* ---------- Variant 3: DA-HUYEN-AO (Arcane Rune Dock) ---------- */
  if (template === 'da-huyen-ao') {
    return (
      <>
        <div className="h-24" aria-hidden />
        <nav
          className="fixed left-1/2 z-40 -translate-x-1/2"
          style={{ bottom: 'max(0.85rem, env(safe-area-inset-bottom))' }}
          aria-label="Điều hướng chính"
        >
          <div
            className="flex items-center gap-1.5 rounded-2xl border px-3 py-2 backdrop-blur-2xl sm:gap-2.5"
            style={{
              borderColor: 'var(--border)',
              background: 'rgba(14, 9, 28, 0.88)',
              boxShadow: '0 12px 40px rgba(139, 92, 246, 0.3)',
            }}
          >
            {TABS.map((t) => {
              const to = t.to === '__account' ? (user ? '/profile' : '/auth') : t.to;
              const active = t.match(pathname);
              return (
                <Link
                  key={t.to}
                  to={to}
                  className="group relative flex flex-col items-center rounded-xl px-2.5 py-1.5 transition sm:px-3.5"
                  style={
                    active
                      ? {
                          background: 'rgba(168, 85, 247, 0.22)',
                          color: 'var(--accent)',
                          boxShadow: 'inset 0 0 12px rgba(34, 211, 238, 0.25)',
                        }
                      : { color: 'var(--muted)' }
                  }
                >
                  {t.icon}
                  <span className="mt-1 text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap">
                    {t.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </>
    );
  }

  /* ---------- Default / TruyenC / TinhHa / ThuCac: Floating Glass Dock ---------- */
  return (
    <>
      <div className="h-28" aria-hidden />
      <nav
        className="fixed left-1/2 z-40 -translate-x-1/2"
        style={{ bottom: 'max(0.9rem, env(safe-area-inset-bottom))' }}
        aria-label="Dock điều hướng"
      >
        <div
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          className="flex items-end gap-1.5 rounded-[26px] border px-2.5 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:gap-2 sm:px-3.5"
          style={{
            borderColor: 'var(--border)',
            background: 'color-mix(in srgb, var(--card-bg) 82%, transparent)',
          }}
        >
          {TABS.map((t, i) => {
            const to = t.to === '__account' ? (user ? '/profile' : '/auth') : t.to;
            const active = t.match(pathname);
            const scale = scales[i] ?? 1;
            return (
              <Link
                key={t.to}
                to={to}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="group relative flex w-[50px] flex-col items-center sm:w-[58px]"
                aria-label={t.label}
              >
                <span
                  className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                  style={{ background: 'var(--ink)', color: 'var(--page-bg)' }}
                >
                  {t.label}
                </span>
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm transition-colors sm:h-12 sm:w-12"
                  style={{
                    background: active ? 'var(--brand)' : 'var(--surface-alt)',
                    color: active ? '#ffffff' : 'var(--ink)',
                    border: '1px solid var(--border)',
                    transform: `scale(${scale}) translateY(${-(scale - 1) * 10}px)`,
                    transformOrigin: 'bottom center',
                    transition: 'transform 90ms ease-out, background-color 150ms ease',
                  }}
                >
                  {t.icon}
                </span>
                <span
                  className="mt-1 text-[10px] font-medium leading-none whitespace-nowrap"
                  style={{ color: active ? 'var(--brand)' : 'var(--muted)' }}
                >
                  {t.label}
                </span>
                <span
                  className="mt-1 h-1 w-1 rounded-full transition-opacity"
                  style={{
                    background: 'var(--brand)',
                    opacity: active ? 1 : 0,
                  }}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

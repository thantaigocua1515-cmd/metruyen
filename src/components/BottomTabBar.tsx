import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChrome } from '../context/ChromeContext';

const TABS = [
  { to: '/', label: 'Trang chủ', icon: '🏠', match: (p: string) => p === '/' },
  { to: '/genres', label: 'Thể loại', icon: '🗂️', match: (p: string) => p.startsWith('/genres') || p.startsWith('/novel') },
  { to: '/search', label: 'Tìm kiếm', icon: '🔍', match: (p: string) => p.startsWith('/search') },
  { to: '/bookshelf', label: 'Tủ sách', icon: '🔖', match: (p: string) => p.startsWith('/bookshelf') },
  { to: '__account', label: 'Tài khoản', icon: '👤', match: (p: string) => p.startsWith('/profile') || p.startsWith('/auth') || p.startsWith('/user') || p.startsWith('/inventory') || p.startsWith('/treasury') },
];

const RANGE = 110; // bán kính hiệu ứng phóng to (px)
const MAX_SCALE = 1.45;

/**
 * Dock nổi kiểu macOS ở cuối trang: kính mờ, icon phóng to khi di chuột
 * tới gần (máy tính), chấm chỉ thị dưới icon đang active.
 * Hiện trên mọi template và mọi kích thước màn hình.
 */
export default function BottomTabBar() {
  const { user } = useAuth();
  const { hidden: chromeHidden } = useChrome();
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
  }, [measure, pathname]);

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

  // Chế độ toàn màn hình khi đọc truyện: ẩn cả dock lẫn spacer
  if (chromeHidden) return null;

  return (
    <>
      {/* spacer để cuối trang không bị dock che */}
      <div className="h-28" aria-hidden />
      <nav
        className="fixed left-1/2 z-40 -translate-x-1/2"
        style={{ bottom: 'max(0.9rem, env(safe-area-inset-bottom))' }}
        aria-label="Dock điều hướng"
      >
        <div
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          className="flex items-end gap-1.5 rounded-[26px] border border-white/50 bg-white/60 px-2.5 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:gap-2 sm:px-3 dark:border-white/10 dark:bg-stone-900/55"
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
                className="group relative flex w-[52px] flex-col items-center sm:w-[58px]"
                aria-label={t.label}
              >
                {/* tooltip kiểu macOS */}
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-stone-900/90 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:bg-white/90 dark:text-stone-900">
                  {t.label}
                </span>
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl text-[22px] shadow-sm ring-1 sm:h-12 sm:w-12 sm:text-2xl ${
                    active
                      ? 'bg-white ring-black/10 dark:bg-white/20 dark:ring-white/20'
                      : 'bg-white/70 ring-black/5 group-hover:bg-white dark:bg-white/10 dark:ring-white/10'
                  }`}
                  style={{
                    transform: `scale(${scale}) translateY(${-(scale - 1) * 10}px)`,
                    transformOrigin: 'bottom center',
                    transition: 'transform 90ms ease-out',
                  }}
                >
                  {t.icon}
                </span>
                <span className="mt-1 text-[9px] font-medium leading-none text-stone-600 dark:text-stone-300">
                  {t.label}
                </span>
                {/* chấm "đang mở" kiểu macOS */}
                <span
                  className={`mt-1 h-1 w-1 rounded-full bg-stone-800 transition-opacity dark:bg-white ${
                    active ? 'opacity-80' : 'opacity-0'
                  }`}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

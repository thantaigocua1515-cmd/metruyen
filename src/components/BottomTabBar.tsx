import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';

const TABS = [
  { to: '/', label: 'Trang chủ', icon: '🏠', match: (p: string) => p === '/' },
  { to: '/genres', label: 'Thể loại', icon: '🗂️', match: (p: string) => p.startsWith('/genres') || p.startsWith('/novel') },
  { to: '/search', label: 'Tìm kiếm', icon: '🔍', match: (p: string) => p.startsWith('/search') },
  { to: '/bookshelf', label: 'Tủ sách', icon: '🔖', match: (p: string) => p.startsWith('/bookshelf') },
  { to: '__account', label: 'Tài khoản', icon: '👤', match: (p: string) => p.startsWith('/profile') || p.startsWith('/auth') || p.startsWith('/user') || p.startsWith('/inventory') || p.startsWith('/treasury') },
];

/**
 * Thanh tab dưới cùng kiểu app mobile — chỉ hiện khi template `truyenc`
 * và trên màn hình nhỏ. Màu active ăn theo var(--brand).
 */
export default function BottomTabBar() {
  const { template } = useTemplate();
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (template !== 'truyenc') return null;

  return (
    <>
      {/* spacer để footer không bị che */}
      <div className="h-[68px] sm:hidden" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--card-bg)] sm:hidden" style={{ borderColor: 'color-mix(in srgb, var(--ink) 12%, transparent)' }}>
        <div className="grid grid-cols-5">
          {TABS.map((t) => {
            const to = t.to === '__account' ? (user ? '/profile' : '/auth') : t.to;
            const active = t.match(pathname);
            return (
              <Link
                key={t.to}
                to={to}
                className="flex flex-col items-center gap-0.5 py-2 text-[11px]"
                style={{ color: active ? 'var(--brand)' : 'var(--muted)' }}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                <span className={active ? 'font-bold' : 'font-medium'}>{t.label}</span>
              </Link>
            );
          })}
        </div>
        {/* safe-area cho iPhone */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}

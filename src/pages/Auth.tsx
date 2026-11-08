import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTemplate } from '../context/TemplateContext';
import { ArrowLeftIcon, ScrollIcon } from '../components/icons';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login',
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuth();
  const { template } = useTemplate();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') await signUp(username, password);
      else await signIn(username, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const isSwiss = template === 'toi-gian';

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div
        className={`border p-6 shadow-xl sm:p-8 ${isSwiss ? '' : 'rounded-3xl'}`}
        style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
      >
        <div className="flex flex-col items-center text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
          >
            <ScrollIcon className="h-6 w-6" />
          </span>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl" style={{ color: 'var(--ink)' }}>
            Mê Truyện Các
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            {mode === 'login'
              ? 'Đăng nhập để đồng bộ tủ truyện & tích lũy tu vi'
              : 'Tạo đạo hiệu mới để bắt đầu hành trình tu luyện'}
          </p>
        </div>

        <div
          className={`mt-6 grid grid-cols-2 p-1 ${isSwiss ? 'border' : 'rounded-full'}`}
          style={{ background: 'var(--surface-alt)', borderColor: 'var(--border)' }}
        >
          {(['login', 'register'] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`cursor-pointer py-2 text-sm font-bold transition ${
                  isSwiss ? 'uppercase' : 'rounded-full'
                }`}
                style={
                  active
                    ? { background: 'var(--brand)', color: '#fff' }
                    : { color: 'var(--muted)' }
                }
              >
                {m === 'login' ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            );
          })}
        </div>

        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="auth-username"
              className="block text-xs font-bold tracking-wider uppercase"
              style={{ color: 'var(--ink)' }}
            >
              Tên đăng nhập (Username)
            </label>
            <input
              id="auth-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="vd: tieukiem_khach"
              autoComplete="username"
              className={`mt-1.5 h-11 w-full border bg-[var(--page-bg)] px-4 text-sm outline-none transition ${
                isSwiss ? '' : 'rounded-xl'
              }`}
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
              3–20 ký tự: chữ cái, chữ số, _, . hoặc - (không dấu, không khoảng trắng)
            </p>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-bold tracking-wider uppercase"
              style={{ color: 'var(--ink)' }}
            >
              Mật khẩu
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={`mt-1.5 h-11 w-full border bg-[var(--page-bg)] px-4 text-sm outline-none transition ${
                isSwiss ? '' : 'rounded-xl'
              }`}
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`h-11 w-full cursor-pointer font-bold text-white shadow transition hover:opacity-90 disabled:opacity-60 ${
              isSwiss ? 'uppercase' : 'rounded-full'
            }`}
            style={{ background: 'var(--brand)' }}
          >
            {busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Hoàn tất đăng ký'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-75"
            style={{ color: 'var(--muted)' }}
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

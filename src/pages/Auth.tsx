import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-amber-900/15 bg-white p-6 shadow-lg dark:border-amber-100/10 dark:bg-stone-900">
        <h1 className="font-display text-center text-2xl font-bold text-amber-950 dark:text-amber-100">
          📚 Mê Truyện
        </h1>

        <div className="mt-4 grid grid-cols-2 rounded-full bg-stone-100 p-1 dark:bg-stone-800">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-full py-1.5 text-sm font-semibold ${
                mode === m
                  ? 'bg-amber-700 text-white dark:bg-amber-600'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {m === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="vd: tieukiem_khach"
              autoComplete="username"
              className="mt-1 w-full rounded-xl border border-amber-900/20 bg-white px-4 py-2 outline-none focus:border-amber-500 dark:border-amber-100/15 dark:bg-stone-800 dark:text-stone-100"
            />
            <p className="mt-1 text-xs text-stone-400">
              3–20 ký tự: chữ, số, _, . - (không dấu, không khoảng trắng)
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="mt-1 w-full rounded-xl border border-amber-900/20 bg-white px-4 py-2 outline-none focus:border-amber-500 dark:border-amber-100/15 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-amber-700 py-2.5 font-bold text-white hover:bg-amber-800 disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            {busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
          <Link to="/" className="hover:underline">
            ← Về trang chủ
          </Link>
        </p>
      </div>
    </div>
  );
}

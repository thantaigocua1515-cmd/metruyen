import { useEffect, useState } from 'react';

/** Hiện toast từ sự kiện 'mt-toast' (gửi bởi lib/gamification). Đặt 1 lần trong App.tsx. */
export default function ToastHost() {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<{ msg?: string }>).detail?.msg;
      if (!msg) return;
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, msg }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    window.addEventListener('mt-toast', handler);
    return () => window.removeEventListener('mt-toast', handler);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fade-up rounded-full bg-stone-900/95 px-4 py-2 text-center text-sm font-semibold text-amber-100 shadow-xl dark:bg-amber-100 dark:text-stone-900"
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

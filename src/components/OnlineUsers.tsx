import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createPresenceListener,
  getGuestId,
  initPresence,
  pickRandom,
  readPresenceList,
  type PresenceState,
} from '../lib/presence';
import { getSupabase } from '../lib/supabase';

const MAX_SHOWN = 50;

/** Khởi tạo presence cho phiên hiện tại (theo user đăng nhập hoặc khách). */
export function PresenceBootstrap() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (user) {
      initPresence({
        user_id: user.id,
        username: profile?.username ?? 'Đạo hữu',
        avatar_url: profile?.avatar_url ?? null,
        is_guest: false,
      });
    } else {
      const gid = getGuestId();
      initPresence({
        user_id: gid,
        username: `Khách ${gid.slice(-4).toUpperCase()}`,
        avatar_url: null,
        is_guest: true,
      });
    }
  }, [user?.id, profile?.username, profile?.avatar_url]); // eslint-disable-line react-hooks/exhaustive-deps

  return <OnlineUsersButton />;
}

function readingLine(p: PresenceState): string {
  if (p.reading) return `📖 ${p.reading.novel_title} — Ch.${p.reading.chapter}`;
  return '🍃 Đang dạo chơi';
}

/** Nút nhỏ hiện số người online + popup danh sách. */
function OnlineUsersButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<PresenceState[]>([]);
  const [selected, setSelected] = useState<PresenceState | null>(null);

  useEffect(() => {
    const ch = createPresenceListener();
    const refresh = () => setUsers(readPresenceList(ch));
    ch.on('presence', { event: 'sync' }, refresh);
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') refresh();
    });
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      getSupabase().removeChannel(ch);
    };
  }, []);

  const shown = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      // đang đọc truyện lên trước, rồi mới online
      const ar = a.reading ? 0 : 1;
      const br = b.reading ? 0 : 1;
      if (ar !== br) return ar - br;
      return b.online_at - a.online_at;
    });
    return sorted.length > MAX_SHOWN ? pickRandom(sorted, MAX_SHOWN) : sorted;
  }, [users]);

  const myId = user ? user.id : getGuestId();

  return (
    <>
      <button
        onClick={() => {
          setSelected(null);
          setOpen(true);
        }}
        title="Xem ai đang online"
        className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 rounded-full bg-amber-600/95 px-3 py-2 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-amber-500 active:scale-95"
      >
        <span>👥</span>
        <span>{users.length}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
              <p className="font-bold text-stone-900 dark:text-stone-100">
                {selected ? '👤 Thông tin' : `👥 Đang online (${users.length})`}
              </p>
              <div className="flex gap-2">
                {selected && (
                  <button
                    onClick={() => setSelected(null)}
                    className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                  >
                    ← Danh sách
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {selected ? (
                <UserDetail p={selected} onClose={() => setOpen(false)} />
              ) : shown.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">
                  Chưa thấy ai khác... bạn là người đầu tiên! 🎉
                </p>
              ) : (
                <ul className="space-y-1">
                  {shown.map((p) => (
                    <li key={p.user_id}>
                      <button
                        onClick={() => setSelected(p)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-stone-100 dark:hover:bg-stone-800"
                      >
                        <Avatar p={p} size="h-10 w-10" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
                            {p.username}
                            {p.user_id === myId && (
                              <span className="ml-1 text-xs font-normal text-stone-400">(bạn)</span>
                            )}
                            {p.is_guest && (
                              <span className="ml-1 rounded bg-stone-200 px-1 text-[10px] font-normal text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                                khách
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                            {readingLine(p)}
                          </p>
                        </div>
                        <span className="text-stone-300 dark:text-stone-600">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!selected && users.length > MAX_SHOWN && (
                <p className="mt-2 text-center text-xs text-stone-400">
                  Hiển thị ngẫu nhiên {MAX_SHOWN}/{users.length} người
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Avatar({ p, size }: { p: PresenceState; size: string }) {
  if (p.avatar_url) {
    return (
      <img src={p.avatar_url} alt={p.username} className={`${size} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-700 text-lg text-white`}
    >
      {p.is_guest ? '🚶' : p.username.slice(0, 1).toUpperCase()}
    </div>
  );
}

function UserDetail({ p, onClose }: { p: PresenceState; onClose: () => void }) {
  const time = new Date(p.online_at).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center gap-4">
        <Avatar p={p} size="h-16 w-16" />
        <div>
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100">{p.username}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {p.is_guest ? '🚶 Khách vãng lai' : '🙏 Đạo hữu'} · online lúc {time}
          </p>
        </div>
      </div>
      <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
        <p className="text-sm font-bold text-stone-700 dark:text-stone-300">Đang đọc</p>
        {p.reading ? (
          <p className="mt-1 text-sm text-stone-900 dark:text-stone-100">
            📖 <span className="font-bold">{p.reading.novel_title}</span>
            <br />
            <span className="text-amber-700 dark:text-amber-400">
              Chương {p.reading.chapter}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            🍃 Đang dạo chơi, chưa mở truyện nào
          </p>
        )}
      </div>
      {!p.is_guest && (
        <Link
          to={`/user/${p.user_id}`}
          onClick={onClose}
          className="block rounded-xl bg-amber-600 px-4 py-2 text-center text-sm font-bold text-white hover:bg-amber-500"
        >
          Xem trang cá nhân →
        </Link>
      )}
    </div>
  );
}
